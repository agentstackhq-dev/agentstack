# Environments

This template defines `development`, `preview`, and `production`.

Declare required custom environment values in `agentstack.config.json` under `env.custom`.
For this prototype, local validation reads actual values from `.agentstack/env-values.json` when the file exists.

The file uses the same environment -> surface -> variable shape that validation expects:

```json
{
  "preview": {
    "convex": {
      "OPENAI_API_KEY": "sk-preview"
    }
  }
}
```

Missing `.agentstack/env-values.json` is treated as an empty value set. Invalid JSON fails `validate` and `validate:cloud`.
