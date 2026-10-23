using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;

namespace BE.Controllers
{
    [ApiController]
    [Route("api/companion")]
    public class CompanionController : ControllerBase
    {
        private readonly HttpClient _httpClient = new HttpClient();

        [HttpPost("ask")]
        public async Task<IActionResult> AskCTGuide([FromBody] UserQuery query)
        {
            // Request payload for the local Ollama model
            var ollamaPayload = new
            {
                model = "ct-robot",
                prompt = query.Text,
                stream = false
            };

            try
            {
                // Connects to Ollama running on the host machine
                var response = await _httpClient.PostAsJsonAsync("http://host.docker.internal:11434/api/generate", ollamaPayload);
                var result = await response.Content.ReadFromJsonAsync<OllamaResponse>();

                // Formats the response according to the API Guide
                var workflow = new
                {
                    WorkflowID = "ct-guide-response",
                    WorkflowName = "CT Scan Companion Response",
                    RobotId = "robot-001",
                    Steps = new[]
                    {
                        new
                        {
                            StepId = "Step-1",
                            ScreenId = "Confirmation",
                            Title = "Patient Companion",
                            TTS = result?.Response ?? "Sorry, I could not understand that. Please try again.",
                            Buttons = new
                            {
                                Yes = new { Label = "Understood", Action = "Next" },
                                No = new { Label = "Repeat", Action = "Previous" }
                            }
                        }
                    }
                };

                return Ok(workflow);
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class UserQuery { public string Text { get; set; } }
    public class OllamaResponse { public string Response { get; set; } }
}