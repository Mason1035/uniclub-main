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

    def test_missing_role_credentials_never_reports_success(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(main_handler(self.event, None)["statusCode"], 503)


if __name__ == "__main__":
    unittest.main()
