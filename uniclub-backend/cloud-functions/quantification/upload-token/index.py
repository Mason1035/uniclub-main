# -*- coding: utf-8 -*-
"""Python SCF: server-to-server role credential bridge for ClassHub."""
import json
import os
import re
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
    bucket, region = str(query.get("bucket", "")), str(query.get("region", ""))
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}-[0-9]{5,20}", bucket) or not re.fullmatch(r"ap-[a-z0-9-]{2,30}", region):
        return response(400, {"success": False, "error": "Invalid storage target"})
    credentials = {
        "TmpSecretId": os.environ.get("TENCENTCLOUD_SECRETID"),
        "TmpSecretKey": os.environ.get("TENCENTCLOUD_SECRETKEY"),
        "Token": os.environ.get("TENCENTCLOUD_SESSIONTOKEN"),
    }
    if not all(credentials.values()):
        return response(503, {"success": False, "error": "SCF role credentials unavailable"})
    return response(200, {"success": True, "integrationVersion": 1, "credentials": credentials, "bucket": bucket, "region": region})
