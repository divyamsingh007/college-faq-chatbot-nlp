from __future__ import annotations

from urllib.parse import quote

import httpx


class GeminiConfigurationError(RuntimeError):
    pass


class GeminiGenerationError(RuntimeError):
    pass


def generate_answer(prompt: str, api_key: str, model: str) -> str:
    if not api_key:
        raise GeminiConfigurationError('GEMINI_API_KEY is not configured.')

    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'{quote(model, safe="")}:generateContent'
    )
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                url,
                headers={'x-goog-api-key': api_key},
                json={
                    'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
                    'generationConfig': {
                        'temperature': 0.2,
                        'maxOutputTokens': 768,
                    },
                },
            )
    except httpx.TimeoutException as error:
        raise GeminiGenerationError('The Gemini request timed out.') from error
    except httpx.HTTPError as error:
        raise GeminiGenerationError('The Gemini request failed.') from error

    if response.is_error:
        raise GeminiGenerationError(
            f'Gemini returned HTTP {response.status_code}. Check the API key and model configuration.'
        )

    try:
        payload = response.json()
        parts = payload['candidates'][0]['content']['parts']
        answer = '\n'.join(part['text'] for part in parts if part.get('text'))
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise GeminiGenerationError('Gemini returned an empty or invalid response.') from error

    if not answer.strip():
        raise GeminiGenerationError('Gemini returned an empty answer.')
    return answer.strip()
