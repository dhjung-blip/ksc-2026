# KSC 2026 라이브 Q&A

참가자가 QR로 접속해 **프로그램(발표)을 골라 질문**하고, 진행자가 프로그램별로
우수 질문 2개를 선정하는 웹앱. 6개 프로그램이 동시에 열려 있고 참가자는 언제든
프로그램을 바꿀 수 있습니다. 도메인·서버 비용 없음 (Netlify + Supabase 무료).

- 라이브: https://ksc-2026.netlify.app
- 저장소: https://github.com/dhjung-blip/ksc-2026

## 화면

| 주소 | 대상 | 내용 |
|---|---|---|
| `/` | 참가자 (QR) | 프로그램 선택 → 질문 등록(이름 선택·전화 뒤 4자리 필수) → 결과 확인 |
| `/admin.html` | 진행자 | 프로그램별 접수 열기/마감, ⭐ 선정(최대 2)·삭제, 전화 뒷자리 확인 |
| `/screen.html` | 빔프로젝터 | 전체 프로그램 현황판. 클릭 또는 `?s=번호`로 프로그램 보드 이동 |

전화번호 뒤 4자리는 우수 질문 경품 본인 확인용으로, DB 권한 설정상
일반 API·참가자·스크린에는 노출되지 않고 진행자 화면에서만 조회됩니다.

## 설정

1. **Supabase**: SQL Editor에서 `supabase.sql` 실행(관리자 암호 먼저 수정) 후
   `migrate-v3.sql` 실행 — 프로그램 6개가 열린 상태로 준비됩니다.
2. **config.js**: Project URL과 publishable 키(`sb_publishable_...`) 입력.
   `SESSION_TITLES`는 데모 모드 표시에 쓰이고, 실서비스 제목은 DB(rounds)에서 옵니다.
3. **배포**: Netlify에 폴더 드래그&드롭. 수정 후 재배포 시 캐시 무효화를 위해
   HTML의 `style.css?v=N`·`app.js?v=N` 버전을 올리세요.

## 운영

- 데모/리허설: 어떤 페이지든 `?demo=1`을 붙이면 브라우저 로컬 데이터로만 동작
- 행사 전 초기화: `truncate table questions, rounds restart identity cascade;`
  실행 후 `migrate-v3.sql`의 insert 부분으로 프로그램 재등록 (또는 migrate-v3 전체 재실행)
- Supabase 무료 플랜은 1주 무활동 시 일시정지 — 행사 전날 접속 확인
