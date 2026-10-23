namespace AcuApiGateway.Models;

/// <summary>A temporary message passed to a chat model. It is never persisted by ACU.</summary>
public sealed record ConversationMessage(string Role, string Content);

/// <summary>Provider-neutral model result.</summary>
public sealed record ChatModelReply(string Text, string Language, bool IsMock);
