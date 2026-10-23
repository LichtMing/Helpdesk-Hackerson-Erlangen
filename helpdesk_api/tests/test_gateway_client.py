import unittest
from unittest.mock import Mock, patch

import gateway_client


def response(status_code=200, payload=None):
    result = Mock()
    result.status_code = status_code
    result.json.return_value = payload
    result.raise_for_status.return_value = None
    return result


class GatewayClientTests(unittest.TestCase):
    def setUp(self):
        gateway_client._found_device = None

    @patch("gateway_client.requests.get")
    def test_auto_selects_an_approved_online_robot(self, get):
        get.return_value = response(payload=[
            {"deviceId": "offline", "status": "approved", "online": False},
            {"deviceId": "pending", "status": "pending", "online": True},
            {"deviceId": "online", "status": "approved", "online": True},
        ])

        with patch.object(gateway_client, "DEVICE_ID", "auto"):
            self.assertEqual(gateway_client.device_id(), "online")
            self.assertEqual(gateway_client.device_id(), "online")

        get.assert_called_once()

    @patch("gateway_client.requests.post")
    @patch("gateway_client.requests.put")
    def test_updates_and_assigns_text_workflow_to_explicit_robot(self, put, post):
        put.return_value = response()
        post.return_value = response(status_code=204)

        target = gateway_client.publish_answer(
            "Please stay still.",
            robot_id="robot/001",
        )

        self.assertEqual(target, "robot/001")
        workflow = put.call_args.kwargs["json"]
        self.assertEqual(workflow["RobotId"], "robot/001")
        self.assertEqual(workflow["Steps"][0]["TTS"], "Please stay still.")
        self.assertNotIn("Audio", workflow["Steps"][0])
        self.assertTrue(post.call_args.args[0].endswith("/assignments/robot%2F001"))

    @patch("gateway_client.requests.post")
    @patch("gateway_client.requests.put")
    def test_creates_missing_workflow_before_assignment(self, put, post):
        put.return_value = response(status_code=404)
        post.side_effect = [response(status_code=201), response(status_code=204)]

        gateway_client.publish_answer("Hello", robot_id="robot-001")

        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args_list[0].args[0], f"{gateway_client.GATEWAY_URL}/api/workflows/robot")
        self.assertIn("/assignments/robot-001", post.call_args_list[1].args[0])


if __name__ == "__main__":
    unittest.main()
