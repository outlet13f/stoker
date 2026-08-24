# 번들된 웹폰트

외부 요청을 없애기 위해 라틴 서브셋만 내려받아 함께 배포합니다.
한글은 시스템 폰트를 씁니다(웹폰트로 받으면 수 MB이고, macOS·Windows 모두
품질 좋은 기본 한글 서체가 있습니다).

| 파일 | 서체 | 라이선스 |
|---|---|---|
| `archivo-var.woff2` | Archivo (가변, wght 100–900) | SIL Open Font License 1.1 |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono Regular | SIL Open Font License 1.1 |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono Medium | SIL Open Font License 1.1 |
| `ibm-plex-mono-600.woff2` | IBM Plex Mono SemiBold | SIL Open Font License 1.1 |

두 서체 모두 OFL 1.1 이라 재배포가 허용됩니다.

- Archivo — https://github.com/Omnibus-Type/Archivo
- IBM Plex — https://github.com/IBM/plex

원본은 Google Fonts 가 제공하는 `latin` 서브셋 woff2 입니다.
`npm run fonts` 로 다시 받을 수 있습니다.
