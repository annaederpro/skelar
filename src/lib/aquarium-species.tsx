// 12 species, unlocked progressively by total completed-task count.
// Icons share a 38x30 viewBox so the same JSX renders in the tank and the grid.
export const SPECIES: { name: string; threshold: number; icon: React.ReactNode }[] = [
  {
    name: "Клоун",
    threshold: 1,
    icon: (
      <>
        <path d="M6 15 q11 -9 22 0 q-11 9 -22 0Z" fill="#E7936F" />
        <path d="M28 15 l7 -4 v8Z" fill="#DF8464" />
        <rect x="14" y="8" width="3" height="14" fill="#fff" />
        <circle cx="11" cy="13" r="1.4" fill="#33403E" />
      </>
    ),
  },
  {
    name: "Морський коник",
    threshold: 6,
    icon: (
      <>
        <path
          d="M14 6 q7 -2 7 5 q0 6 -6 8 q-5 2 -4 8"
          fill="none"
          stroke="#C58BB0"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="14" cy="7" r="2.2" fill="#C58BB0" />
      </>
    ),
  },
  {
    name: "Зірка",
    threshold: 12,
    icon: <path d="M18 5 l3 8 8 1 -6 6 2 8 -7 -4 -7 4 2 -8 -6 -6 8 -1Z" fill="#DF8464" />,
  },
  {
    name: "Хірург",
    threshold: 20,
    icon: (
      <>
        <path d="M6 15 q11 -9 22 0 q-11 9 -22 0Z" fill="#5CB0AE" />
        <path d="M28 15 l7 -4 v8Z" fill="#EBD98A" />
        <circle cx="11" cy="13" r="1.4" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Медуза",
    threshold: 30,
    icon: (
      <>
        <path d="M10 13 q9 -12 18 0 q-2 3 -9 3 q-7 0 -9 -3Z" fill="#B98AC0" opacity=".85" />
        <path
          d="M13 16 q0 6 -1 10 M19 17 q0 6 0 10 M25 16 q1 6 1 10"
          stroke="#C9A0CF"
          strokeWidth="2"
          fill="none"
          opacity=".7"
        />
      </>
    ),
  },
  {
    name: "Черепаха",
    threshold: 42,
    icon: (
      <>
        <ellipse cx="17" cy="16" rx="11" ry="8" fill="#4FA0A0" />
        <ellipse cx="29" cy="14" rx="4.5" ry="3.5" fill="#5FB0AE" />
        <circle cx="31" cy="13" r=".9" fill="#1E4E56" />
        <ellipse cx="9" cy="22" rx="3" ry="2" fill="#5FB0AE" />
        <ellipse cx="24" cy="23" rx="3" ry="2" fill="#5FB0AE" />
      </>
    ),
  },
  {
    name: "Краб",
    threshold: 56,
    icon: (
      <>
        <ellipse cx="19" cy="17" rx="8" ry="6" fill="#DF8464" />
        <circle cx="16" cy="15" r="1" fill="#33403E" />
        <circle cx="22" cy="15" r="1" fill="#33403E" />
        <path
          d="M11 14 q-4 -2 -5 -6 M27 14 q4 -2 5 -6"
          stroke="#DF8464"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="6" cy="7" r="2.5" fill="#E7936F" />
        <circle cx="32" cy="7" r="2.5" fill="#E7936F" />
      </>
    ),
  },
  {
    name: "Риба-їжак",
    threshold: 72,
    icon: (
      <>
        <circle cx="17" cy="15" r="8" fill="#EBD98A" />
        <g stroke="#D9C46A" strokeWidth="1.6" strokeLinecap="round">
          <path d="M17 4 v3 M17 23 v3 M6 15 h3 M25 15 h3 M9 7 l2 2 M25 21 l2 2 M9 23 l2 -2 M25 9 l2 -2" />
        </g>
        <circle cx="14" cy="13" r="1.2" fill="#33403E" />
      </>
    ),
  },
  {
    name: "Актинія",
    threshold: 90,
    icon: (
      <>
        <g stroke="#B98AC0" strokeWidth="3" strokeLinecap="round">
          <path d="M12 24 q-2 -8 -4 -10 M16 24 q0 -9 -1 -12 M20 24 q1 -9 2 -12 M24 24 q3 -7 5 -9" />
        </g>
        <ellipse cx="18" cy="25" rx="9" ry="3" fill="#C58BB0" />
      </>
    ),
  },
  {
    name: "Скат",
    threshold: 110,
    icon: (
      <>
        <path
          d="M5 13 q13 -9 28 1 q-9 2 -12 1 l-2 9 -3 -8 q-6 0 -11 -3Z"
          fill="#9FC7C9"
        />
        <circle cx="13" cy="12" r="1" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Дельфін",
    threshold: 132,
    icon: (
      <>
        <path
          d="M5 18 q6 -10 10 -6 l3 -5 1 6 q9 0 13 7 q-8 4 -14 2 q-2 4 -5 3 l1 -4 q-6 0 -9 -3Z"
          fill="#5CB0AE"
        />
        <circle cx="27" cy="16" r=".9" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Кит",
    threshold: 156,
    icon: (
      <>
        <path d="M4 18 q1 -9 14 -9 q13 0 16 8 q-3 5 -12 5 q-13 0 -18 -4Z" fill="#3E8E9C" />
        <path
          d="M25 6 q1 3 0 4 M28 5 q0 3 -1 5"
          stroke="#8FC6CD"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="10" cy="15" r="1.1" fill="#fff" />
      </>
    ),
  },
];
