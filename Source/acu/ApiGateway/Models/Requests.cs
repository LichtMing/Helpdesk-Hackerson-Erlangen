using System.ComponentModel.DataAnnotations;

namespace AcuApiGateway.Models;

/// <summary>Payload sent by a robot when registering with the ACU.</summary>
public class RegisterRequest
{
    /// <example>robot-001</example>
    [Required]
    public string DeviceId { get; set; } = "";

    /// <example>Warehouse Bot A</example>
    public string Name { get; set; } = "";

    /// <example>192.168.1.42</example>
    public string Ip { get; set; } = "";

    /// <example>AA:BB:CC:DD:EE:FF</example>
    [Required]
    public string Mac { get; set; } = "";

    /// <example>v1.2.3</example>
    public string Firmware { get; set; } = "";
}

/// <summary>Instruction payload sent by the UI operator to a robot.</summary>
public class InstructionRequest
{
    /// <example>move_forward</example>
    [Required]
    public string Command { get; set; } = "";
}

/// <summary>Payload sent by a robot when unregistering.</summary>
public class UnregisterRequest
{
    /// <example>AA:BB:CC:DD:EE:FF</example>
    [Required]
    public string Mac { get; set; } = "";
}

/// <summary>Locally transcribed patient speech sent by an approved robot.</summary>
public class TranscriptRequest
{
    /// <example>AA:BB:CC:DD:EE:FF</example>
    [Required]
    public string Mac { get; set; } = "";

    /// <example>Do I need to remove my glasses before the MRI?</example>
    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Text { get; set; } = "";

    /// <example>en</example>
    [Required]
    [StringLength(16, MinimumLength = 2)]
    public string Language { get; set; } = "auto";

    /// <summary>Client-generated ID used to match the ACU receipt.</summary>
    [Required]
    [StringLength(128, MinimumLength = 1)]
    public string RequestId { get; set; } = "";
}

/// <summary>Patient text submitted to the ACU conversation pipeline.</summary>
public class ChatRequest
{
    /// <example>robot-001</example>
    [Required]
    public string DeviceId { get; set; } = "";

    /// <example>AA:BB:CC:DD:EE:FF</example>
    [Required]
    public string Mac { get; set; } = "";

    /// <summary>Opaque identifier for one patient's temporary conversation.</summary>
    [Required]
    [StringLength(128, MinimumLength = 1)]
    public string SessionId { get; set; } = "";

    /// <summary>Client-generated identifier used to correlate one turn.</summary>
    [Required]
    [StringLength(128, MinimumLength = 1)]
    public string RequestId { get; set; } = "";

    /// <example>How long will the MRI scan take?</example>
    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Text { get; set; } = "";

    /// <example>en</example>
    [Required]
    [StringLength(16, MinimumLength = 2)]
    public string Language { get; set; } = "auto";
}

/// <summary>Clears one temporary conversation from ACU memory.</summary>
public class ResetConversationRequest
{
    [Required]
    public string DeviceId { get; set; } = "";

    [Required]
    public string Mac { get; set; } = "";

    [Required]
    [StringLength(128, MinimumLength = 1)]
    public string SessionId { get; set; } = "";
}

/// <summary>Text to synthesize locally on the ACU without writing audio to disk.</summary>
public class SynthesizeSpeechRequest
{
    [Required]
    public string DeviceId { get; set; } = "";

    [Required]
    public string Mac { get; set; } = "";

    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Text { get; set; } = "";

    [Required]
    [StringLength(16, MinimumLength = 2)]
    public string Language { get; set; } = "en";
}

/// <summary>Payload to assign a workflow to a device.</summary>
public class AssignmentRequest
{
    /// <example>3f8c1e9a-1b2c-4d5e-8f90-abc123def456</example>
    [Required]
    public string WorkflowId { get; set; } = "";
}
