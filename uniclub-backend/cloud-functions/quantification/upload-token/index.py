# -*- coding: utf-8 -*-
"""Python SCF: server-to-server role credential bridge for ClassHub."""
import json
import os
import re
import hmac
from urllib.parse import parse_qs


def response(status, data):
    return {"statusCode": status, "headers": {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}, "body": json.dumps(data, ensure_ascii=False)}


def main_handler(event, context):
    if event.get("httpMethod", "GET").upper() != "GET":
        return response(405, {"success": False, "error": "Method not allowed"})
    query = event.get("queryString") or event.get("queryStringParameters") or {}
    if isinstance(query, str):
        query = {key: values[0] for key, values in parse_qs(query).items()}
    if not isinstance(query, dict):
        return response(400, {"success": False, "error": "Invalid parameters"})
    secret = os.environ.get("CLASSHUB_SCF_AUTH_SECRET", "")
    headers = event.get("headers") or {}
    supplied = next((str(value) for key, value in headers.items() if key.lower() == "x-classhub-service-auth"), "") if isinstance(headers, dict) else ""
    if secret and (len(secret) < 32 or not hmac.compare_digest(secret.encode("utf-8"), supplied.encode("utf-8"))):
        return response(403, {"success": False, "error": "Forbidden"})
    business = str(query.get("business", "quantification"))
    prefix = str(query.get("prefix", "quantification/"))
    if business not in ("quantification", "activity"):
        return response(400, {"success": False, "error": "Invalid business"})
    if business == "activity" and (len(secret) < 32 or prefix != "activity/" or not os.environ.get("COS_BUCKET")):
        return response(403, {"success": False, "error": "Activity integration requires secured configuration"})
    if business == "quantification" and (not re.fullmatch(r"(?:[a-zA-Z0-9_-]{1,63}/){1,4}", prefix) or prefix.startswith("activity/")):
        return response(400, {"success": False, "error": "Invalid prefix"})
    bucket, region = str(query.get("bucket", "")), str(query.get("region", ""))
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}-[0-9]{5,20}", bucket) or not re.fullmatch(r"ap-[a-z0-9-]{2,30}", region):
        return response(400, {"success": False, "error": "Invalid storage target"})
    if secret:
        expected_bucket = os.environ.get("COS_BUCKET", "")
        expected_region = os.environ.get("COS_REGION", "ap-guangzhou")
        allowed = [value.strip() for value in os.environ.get("COS_QUANTIFICATION_PREFIXES", "quantification/").split(",") if value.strip()]
        if bucket != expected_bucket or region != expected_region or business == "quantification" and prefix not in allowed:
            return response(403, {"success": False, "error": "Storage target forbidden"})
    credentials = {
        "TmpSecretId": os.environ.get("TENCENTCLOUD_SECRETID"),
        "TmpSecretKey": os.environ.get("TENCENTCLOUD_SECRETKEY"),
        "Token": os.environ.get("TENCENTCLOUD_SESSIONTOKEN"),
    }
    if not all(credentials.values()):
        return response(503, {"success": False, "error": "SCF role credentials unavailable"})
    return response(200, {"success": True, "integrationVersion": 2, "secured": bool(secret), "business": business, "credentials": credentials, "bucket": bucket, "region": region})
