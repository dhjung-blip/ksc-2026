// ===== 설정 =====
// Supabase 연동 전에는 "데모 모드"로 동작합니다 (데이터가 이 브라우저에만 저장됨).
// 실제 운영 시 아래 두 값을 채우면 서버 모드로 전환됩니다. (README.md 참고)
window.CONFIG = {
  EVENT_TITLE: "KSC 2026 Q&A",

  // 라운드(세션) 제목 목록 — 진행자 페이지에서 순서대로 골라 시작합니다.
  SESSION_TITLES: [
    "AI drug discovery: Data, model, and beyond -신현진 소장-",
    "AI agent 기반 합성 가능한 신약 후보물질 설계 -장우대 교수-",
    "AI 전환을 향한 여정 -이제현 실장-",
    "신약개발에서의 AI의 역할 -김승하 팀장-",
    "DeepZema: AI 기반 합성신약 연구개발 플랫폼을 활용한 Drug Discovery -임동철 CTO-",
    "in silico Drug Discovery의 2026년 트렌드: 'AI 신약개발'의 모호함을 넘어 증명(Proof)으로 -오경석 연구위원-",
  ],

  // 프로그램 순서와 1:1 매칭되는 소속·시간 (포스터 기준)
  SESSION_INFO: [
    { org: "목암생명과학연구소", time: "13:30~14:10" },
    { org: "고려대학교 약대", time: "14:10~14:50" },
    { org: "KIST AIX실", time: "14:50~15:30" },
    { org: "LG화학 생명과학 AX팀", time: "16:00~16:40" },
    { org: "이노보테라퓨틱스", time: "16:40~17:20" },
    { org: "대웅제약", time: "17:20~18:00" },
  ],

  SUPABASE_URL: "https://ghuhwnbhvualolpbdpxt.supabase.co",      // 예: https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_DUm0YBRKV-YLIq_G5hhudw_tqJgvRpA", // Supabase > Settings > API Keys > "publishable" 키 (sb_publishable_...) — 구 대시보드에서는 anon public
};
