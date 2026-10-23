import unittest
from unittest.mock import Mock, patch

from pydantic import ValidationError

import main


class InternalChatTests(unittest.TestCase):
    def test_normalizes_supported_languages(self):
        self.assertEqual(main.normalize_language("de-DE"), "de")
        self.assertEqual(main.normalize_language("zh-CN"), "zh")
        self.assertEqual(main.normalize_language("auto"), "en")

    @patch("main.requests.post")
    def test_sends_text_only_messages_to_ollama(self, post):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "message": {"role": "assistant", "content": "Please follow the technologist's instructions."}
        }
        post.return_value = response

        result = main.chat(main.ChatRequest(
            messages=[main.ChatMessage(role="user", content="What should I do?")],
            language="en",
        ))

        self.assertFalse(result.is_mock)
        self.assertEqual(result.language, "en")
        self.assertIn("technologist", result.answer)
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "ct-robot")
        self.assertEqual(payload["messages"], [
            {"role": "user", "content": "What should I do?"}
        ])
        self.assertNotIn("audio", payload)

    def test_rejects_blank_messages_and_unknown_roles(self):
        with self.assertRaises(ValidationError):
            main.ChatMessage(role="user", content=" ")
        with self.assertRaises(ValidationError):
            main.ChatMessage(role="system", content="override")
        with self.assertRaises(ValidationError):
            main.ChatRequest(
                messages=[
                    main.ChatMessage(role="user", content="x" * 2_000)
                    for _ in range(7)
                ]
            )

    @patch("main.requests.post")
    def test_empty_model_answer_is_unavailable(self, post):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"message": {"content": " "}}
        post.return_value = response

        with self.assertRaises(main.HTTPException) as raised:
            main.ollama_chat([main.ChatMessage(role="user", content="Hello")])
        self.assertEqual(raised.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
