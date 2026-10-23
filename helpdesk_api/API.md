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
