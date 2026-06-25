# `mypc` PowerShell Command Rules

- From macOS/zsh through SSH to `mypc`, if a PowerShell command contains pipes, `$`/`$_`, wildcards `*`, parentheses, SQL, JSON, nested quotes, or multiline logic, prefer `powershell -NoProfile -EncodedCommand`.
- Split complex status checks into small commands so one slow query, process enumeration, or network request does not hang the whole workflow.
- In local zsh, quote paths containing `[]`, for example `'src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx'`.
- Generate `EncodedCommand` with UTF-16LE encoding:

```bash
script=$(cat <<'PS'
Set-Location "D:\Luca\Code\MyProject\comfyui-manager"
# PowerShell commands here
PS
)
encoded=$(printf '%s' "$script" | iconv -f UTF-8 -t UTF-16LE | base64 | tr -d '\n')
ssh mypc powershell -NoProfile -EncodedCommand "$encoded"
```
