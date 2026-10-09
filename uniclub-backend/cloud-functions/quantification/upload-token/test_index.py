import json
import os
import unittest
from unittest.mock import patch
from index import main_handler


class HandlerTest(unittest.TestCase):
    def setUp(self):
        self.env = {"TENCENTCLOUD_SECRETID": "test-id", "TENCENTCLOUD_SECRETKEY": "test-key", "TENCENTCLOUD_SESSIONTOKEN": "test-session"}
        self.event = {"httpMethod": "GET", "queryString": {"bucket": "isolated-classhub-1234567890", "region": "ap-guangzhou"}}

    def test_public_get_returns_scf_role_credentials_without_access_headers(self):
        with patch.dict(os.environ, self.env, clear=True):
            result = main_handler(self.event, None)
            self.assertEqual(result["statusCode"], 200)
            body = json.loads(result["body"])
            self.assertEqual(body["credentials"], {"TmpSecretId": "test-id", "TmpSecretKey": "test-key", "Token": "test-session"})
            self.assertEqual(body["bucket"], self.event["queryString"]["bucket"])
            self.assertEqual(body["region"], self.event["queryString"]["region"])
            self.assertEqual(result["headers"]["Cache-Control"], "no-store")

    def test_rejects_invalid_target_and_non_get(self):
        with patch.dict(os.environ, self.env, clear=True):
            self.event["httpMethod"] = "POST"
            self.assertEqual(main_handler(self.event, None)["statusCode"], 405)
            self.event["httpMethod"] = "GET"
            self.event["queryString"]["bucket"] = "../bad"
            self.assertEqual(main_handler(self.event, None)["statusCode"], 400)

    def test_non_ascii_unauthorized_headers_return_forbidden(self):
        secret = "isolated-test-service-secret-32-bytes"
        secured_env = {**self.env, "CLASSHUB_SCF_AUTH_SECRET": secret, "COS_BUCKET": self.event["queryString"]["bucket"]}
        with patch.dict(os.environ, secured_env, clear=True):
            for supplied in ("é", "错误鉴权", secret + "é"):
                with self.subTest(header_kind="non_ascii"):
                    self.event["headers"] = {"X-ClassHub-Service-Auth": supplied}
                    result = main_handler(self.event, None)
                    self.assertEqual(result["statusCode"], 403)
                    body = json.loads(result["body"])
                    self.assertFalse(body["success"])
                    self.assertNotIn("credentials", body)

    def test_missing_role_credentials_never_reports_success(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(main_handler(self.event, None)["statusCode"], 503)

    def test_activity_is_refused_in_legacy_open_mode(self):
        self.event["queryString"].update({"business": "activity", "prefix": "activity/"})
        with patch.dict(os.environ, self.env, clear=True):
            self.assertEqual(main_handler(self.event, None)["statusCode"], 403)

    def test_secured_contract_requires_header_fixed_bucket_region_and_prefix(self):
        secret = "isolated-test-service-secret-32-bytes"
        secured_env = {**self.env, "CLASSHUB_SCF_AUTH_SECRET": secret, "COS_BUCKET": "isolated-classhub-1234567890", "COS_REGION": "ap-guangzhou"}
        self.event["queryString"].update({"business": "activity", "prefix": "activity/"})
        with patch.dict(os.environ, secured_env, clear=True):
            self.assertEqual(main_handler(self.event, None)["statusCode"], 403)
            self.event["headers"] = {"X-ClassHub-Service-Auth": "wrong"}
            self.assertEqual(main_handler(self.event, None)["statusCode"], 403)
            self.event["headers"] = {"x-classhub-service-auth": secret}
            result = main_handler(self.event, None)
            self.assertEqual(result["statusCode"], 200)
            body = json.loads(result["body"])
            self.assertTrue(body["secured"])
            self.assertEqual(body["business"], "activity")
            self.event["queryString"]["bucket"] = "another-bucket-1234567890"
            self.assertEqual(main_handler(self.event, None)["statusCode"], 403)
            self.event["queryString"]["bucket"] = secured_env["COS_BUCKET"]
            self.event["queryString"]["prefix"] = "quantification/"
            self.assertEqual(main_handler(self.event, None)["statusCode"], 403)
            self.event["queryString"].update({"business": "quantification", "prefix": "quantification/"})
            self.assertEqual(main_handler(self.event, None)["statusCode"], 200)


if __name__ == "__main__":
    unittest.main()
