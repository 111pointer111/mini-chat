# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.

## Security Measures

### Authentication
- JWT-based authentication with configurable secret (`JWT_SECRET` env var)
- Production requires `JWT_SECRET` to be set (server exits on missing)
- Admin routes require `admin` role

### Input Validation
- All API inputs validated at route level
- MongoDB uses parameterized queries via Mongoose (no string concatenation)
- File uploads restricted by type and size

### Secret Management
- Secrets stored in environment variables, never in source code
- `.env` files excluded via `.gitignore`
- `.env.example` files provided with placeholder values

### CORS
- Configurable via `CORS_ORIGINS` env var
- Defaults to localhost origins only

### Dependencies
- Run `npm audit` regularly to check for known vulnerabilities
- Keep dependencies updated

## Best Practices for Contributors

- Never commit `.env` files, API keys, or tokens
- Use parameterized queries for any database operations
- Validate and sanitize all user input
- Follow the principle of least privilege for API endpoints
- Report any suspicious findings immediately
