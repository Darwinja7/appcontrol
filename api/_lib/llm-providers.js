// Registro de proveedores LLM compatibles con el API de chat completions
// (formato OpenAI). Todos reciben: POST {baseUrl}/chat/completions.
export const PROVEEDORES = {
  openrouter: {
    nombre: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modeloDefault: "openrouter/stealth/ox-alpha",
    razonamientoBajo: true,
    envFallback: "OPENROUTER_API_KEY"
  },
  huggingface: {
    nombre: "Hugging Face Router",
    baseUrl: "https://router.huggingface.co/v1",
    modeloDefault: "",
    razonamientoBajo: false,
    envFallback: "HF_API_KEY"
  },
  opencode: {
    nombre: "OpenCode",
    baseUrl: "https://opencode.ai/zen/v1",
    modeloDefault: "",
    razonamientoBajo: false,
    envFallback: "OPENCODE_API_KEY"
  },
  orcarouter: {
    nombre: "OrcaRouter",
    baseUrl: "https://api.orcarouter.com/v1",
    modeloDefault: "",
    razonamientoBajo: false,
    envFallback: "ORCA_API_KEY"
  },
  openai: {
    nombre: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modeloDefault: "gpt-4o-mini",
    razonamientoBajo: false,
    envFallback: "OPENAI_API_KEY"
  },
  anthropic: {
    nombre: "Anthropic (compatible OpenAI)",
    baseUrl: "https://api.anthropic.com/v1",
    modeloDefault: "claude-sonnet-4-20250514",
    razonamientoBajo: false,
    envFallback: "ANTHROPIC_API_KEY"
  },
  groq: {
    nombre: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modeloDefault: "llama-3.3-70b-versatile",
    razonamientoBajo: false,
    envFallback: "GROQ_API_KEY"
  },
  personalizado: {
    nombre: "Personalizado (compatible OpenAI)",
    baseUrl: "",
    modeloDefault: "",
    razonamientoBajo: false,
    envFallback: ""
  }
};

export function resolverProveedor(nombre) {
  return PROVEEDORES[String(nombre || "").toLowerCase()] || null;
}
