# 번들된 웹폰트

외부 요청을 없애기 위해 라틴 서브셋만 내려받아 함께 배포합니다.
한글은 시스템 폰트를 씁니다(웹폰트로 받으면 수 MB이고, macOS·Windows 모두
품질 좋은 기본 한글 서체가 있습니다).

| 파일 | 서체 | 라이선스 |
|---|---|---|
| `inter-var.woff2` | Inter (가변, wght 400–700) | SIL Open Font License 1.1 |
| `jetbrains-mono-var.woff2` | JetBrains Mono (가변, wght 400–600) | SIL Open Font License 1.1 |

두 서체 모두 OFL 1.1 이라 재배포가 허용됩니다.

- Inter — https://github.com/rsms/inter
- JetBrains Mono — https://github.com/JetBrains/JetBrainsMono

굵기별로 따로 받지 않는 이유는 Google Fonts 가 두 서체 모두 **가변 폰트 하나**로
넘기기 때문입니다. `wght@400;500;600` 으로 요청하면 같은 파일이 세 번 내려와
번들만 3배가 됩니다.

원본은 Google Fonts 가 제공하는 `latin` 서브셋 woff2 입니다.
`npm run fonts` 로 다시 받을 수 있습니다.
