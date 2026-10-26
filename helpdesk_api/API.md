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
  "language": "en"
}
~~~

Response:

~~~json
{
  "answer": "Yes. The technologist will tell you when to stay still.",
  "language": "en",
  "is_mock": false
}
~~~

Only `user` and `assistant` roles are accepted. Message content and history
length are bounded. No audio endpoint exists by design.

The service runs on Python 3.12 with FastAPI `0.159.1` and Pydantic `2.14.1`.
The Docker image installs `requirements.lock`, which pins all transitive
packages; see [`README.md`](README.md) and
[`../docs/DEPENDENCIES.md`](../docs/DEPENDENCIES.md).
