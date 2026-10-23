# Internal model contract

`helpdesk-api` is reachable only from ACU services. Android robots use the
public ApiGateway endpoints documented in `Source/acu/CONVERSATION_PIPELINE.md`.

## POST /internal/chat

Request:

~~~json
{
  "messages": [
    { "role": "user", "content": "How long does the CT scan take?" },
    { "role": "assistant", "content": "The scan team can explain the expected timing." },
    { "role": "user", "content": "Will I need to stay still?" }
  ],
  "language": "en",
  "robotId": "robot-001"
}
~~~

Response:

~~~json
{
  "answer": "Yes. The technologist will tell you when to stay still.",
  "language": "en",
  "is_mock": false,
  "robot_delivery": "sent_to_robot_text_only"
}
~~~

Only `user` and `assistant` roles are accepted. Message content and history
length are bounded. No audio endpoint exists by design.

## Module interfaces

The integration keeps the function boundary defined on the teammate's
`helpdesk-api` branch:

| Module | Function | Result |
|---|---|---|
| Android STT | local transcript callback | Recognized text; raw audio stays on the robot |
| Model adapter | `ollama_chat(messages)` | Qwen answer text |
| `gateway_client.py` | `publish_answer(text, audio_path=None)` | Publishes and assigns a robot workflow; raises on failure |

`publish_answer` also accepts an optional keyword-only `robot_id`. ApiGateway
uses it to route the answer to the robot that sent `/api/chat`. Calls using the
original two-argument interface remain compatible. If the ID is omitted,
`ROBOT_DEVICE_ID=auto` selects an approved robot and prefers one marked online.

The gateway delivery contains text/TTS workflow metadata only. The removed
server-side `/api/chat/audio` and Python STT path are not restored.
