/**
 * 수식 템플릿 갤러리 데이터 (지연 로딩 전용 모듈).
 * 대수·기초, 미적분·극한, 확률·통계, 선형대수, 물리, 화학식·기호 6개 분류 총 42개 예시.
 */

export const MATH_CATEGORIES = [
  '대수·기초',
  '미적분·극한',
  '확률·통계',
  '선형대수',
  '물리',
  '화학식·기호',
] as const;

export type MathCategory = (typeof MATH_CATEGORIES)[number];

export interface MathTemplate {
  id: string;
  category: MathCategory;
  name: string;
  description: string;
  latex: string;
  /** true이면 $$ ... $$ 블록 수식, false이면 $ ... $ 인라인 수식 */
  isBlock: boolean;
}

export const MATH_TEMPLATES: readonly MathTemplate[] = [
  // 1. 대수·기초 (8개)
  {
    id: 'math-alg-frac',
    category: '대수·기초',
    name: '기본 분수',
    description: '분자와 분모로 이루어진 기본 분수 표기',
    latex: '\\frac{a + b}{c + d}',
    isBlock: false,
  },
  {
    id: 'math-alg-cfrac',
    category: '대수·기초',
    name: '연분수',
    description: '다층 구조의 연분수 전개식',
    latex: 'a_0 + \\cfrac{1}{a_1 + \\cfrac{1}{a_2 + \\cfrac{1}{a_3}}}',
    isBlock: true,
  },
  {
    id: 'math-alg-sqrt',
    category: '대수·기초',
    name: '제곱근과 거듭제곱근',
    description: '루트 기호와 n제곱근 수식',
    latex: '\\sqrt{x^2 + y^2}, \\quad \\sqrt[n]{a^m}',
    isBlock: false,
  },
  {
    id: 'math-alg-quadratic',
    category: '대수·기초',
    name: '이차방정식 근의 공식',
    description: 'ax^2 + bx + c = 0의 일반해 공식',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    isBlock: true,
  },
  {
    id: 'math-alg-binomial',
    category: '대수·기초',
    name: '이항정리',
    description: '두 항의 거듭제곱 전개 공식',
    latex: '(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k',
    isBlock: true,
  },
  {
    id: 'math-alg-log',
    category: '대수·기초',
    name: '로그 밑 변환 공식',
    description: '자연로그를 이용한 로그 밑 변환',
    latex: '\\log_a b = \\frac{\\ln b}{\\ln a}',
    isBlock: false,
  },
  {
    id: 'math-alg-euler',
    category: '대수·기초',
    name: '오일러 항등식',
    description: '복소수 지수와 삼각함수를 잇는 항등식',
    latex: 'e^{i\\pi} + 1 = 0',
    isBlock: true,
  },
  {
    id: 'math-alg-piecewise',
    category: '대수·기초',
    name: '구간별 정의 함수',
    description: '조건에 따라 식이 달라지는 조각 함수',
    latex: 'f(x) = \\begin{cases} x^2 & (x \\ge 0) \\\\ -x & (x < 0) \\end{cases}',
    isBlock: true,
  },

  // 2. 미적분·극한 (8개)
  {
    id: 'math-calc-limit',
    category: '미적분·극한',
    name: '도함수의 정의',
    description: '극한을 이용한 미분계수와 도함수 정의',
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}",
    isBlock: true,
  },
  {
    id: 'math-calc-euler-lim',
    category: '미적분·극한',
    name: '자연상수 e의 극한',
    description: '무한 수열 극한을 통한 자연상수 e 정의',
    latex: '\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e',
    isBlock: true,
  },
  {
    id: 'math-calc-partial',
    category: '미적분·극한',
    name: '편미분과 그래디언트',
    description: '다변수 함수의 편도함수 벡터',
    latex: '\\nabla f = \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z} \\right)',
    isBlock: true,
  },
  {
    id: 'math-calc-def-int',
    category: '미적분·극한',
    name: '미적분학의 기본 정리',
    description: '구간 [a, b]에서의 정적분과 부정적분의 관계',
    latex: '\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)',
    isBlock: true,
  },
  {
    id: 'math-calc-double-int',
    category: '미적분·극한',
    name: '이중 적분',
    description: '2차원 평면 영역 D에서의 중적분',
    latex: '\\iint_{D} f(x, y)\\,dx\\,dy',
    isBlock: true,
  },
  {
    id: 'math-calc-line-int',
    category: '미적분·극한',
    name: '폐곡선 선적분',
    description: '닫힌 경로 C를 따라가는 벡터장 적분',
    latex: '\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r}',
    isBlock: true,
  },
  {
    id: 'math-calc-taylor',
    category: '미적분·극한',
    name: '테일러 급수 전개',
    description: '매끄러운 함수를 거듭제곱 급수로 근사하는 공식',
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n',
    isBlock: true,
  },
  {
    id: 'math-calc-fourier',
    category: '미적분·극한',
    name: '푸리에 변환',
    description: '시간 영역 신호를 주파수 영역으로 변환하는 적분',
    latex: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(t) e^{-2\\pi i \\xi t}\\,dt',
    isBlock: true,
  },

  // 3. 확률·통계 (7개)
  {
    id: 'math-stat-mean-var',
    category: '확률·통계',
    name: '표본 평균과 표본 분산',
    description: '데이터의 중심 경향과 산포도를 나타내는 기초 통계량',
    latex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i, \\quad s^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2',
    isBlock: true,
  },
  {
    id: 'math-stat-normal',
    category: '확률·통계',
    name: '정규분포 확률밀도함수',
    description: '평균 mu, 표준편차 sigma인 가우스 정규분포',
    latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} \\exp\\left(-\\frac{(x - \\mu)^2}{2\\sigma^2}\\right)',
    isBlock: true,
  },
  {
    id: 'math-stat-bayes',
    category: '확률·통계',
    name: '베이즈 정리',
    description: '사전확률과 우도로부터 사후확률을 구하는 조건부 확률 공식',
    latex: 'P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}',
    isBlock: true,
  },
  {
    id: 'math-stat-binom-pmf',
    category: '확률·통계',
    name: '이항분포 확률질량함수',
    description: '독립 시행 n번 중 k번 성공할 확률',
    latex: 'P(X = k) = \\binom{n}{k} p^k (1 - p)^{n-k}',
    isBlock: true,
  },
  {
    id: 'math-stat-poisson',
    category: '확률·통계',
    name: '포아송 분포',
    description: '단위 시간·공간 내 사건 발생 횟수의 확률분포',
    latex: 'P(X = k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}',
    isBlock: true,
  },
  {
    id: 'math-stat-corr',
    category: '확률·통계',
    name: '피어슨 상관계수',
    description: '두 변수 사이의 선형 상관관계를 측정하는 지표',
    latex: 'r_{xy} = \\frac{\\sum_{i=1}^{n}(x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum_{i=1}^{n}(x_i - \\bar{x})^2}\\sqrt{\\sum_{i=1}^{n}(y_i - \\bar{y})^2}}',
    isBlock: true,
  },
  {
    id: 'math-stat-entropy',
    category: '확률·통계',
    name: '섀넌 정보 엔트로피',
    description: '확률변수의 불확실성 및 평균 정보량 공식',
    latex: 'H(X) = -\\sum_{i=1}^{n} P(x_i) \\log_2 P(x_i)',
    isBlock: true,
  },

  // 4. 선형대수 (7개)
  {
    id: 'math-linalg-mat2x2',
    category: '선형대수',
    name: '2×2 소괄호 행렬',
    description: '2행 2열 기본 소괄호 행렬 표기',
    latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    isBlock: true,
  },
  {
    id: 'math-linalg-mat3x3',
    category: '선형대수',
    name: '3×3 대괄호 행렬',
    description: '3행 3열 각진 대괄호 행렬 표기',
    latex: '\\begin{bmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{bmatrix}',
    isBlock: true,
  },
  {
    id: 'math-linalg-det',
    category: '선형대수',
    name: '행렬식 (Determinant)',
    description: '2×2 행렬의 행렬식 계산 공식',
    latex: '\\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc',
    isBlock: true,
  },
  {
    id: 'math-linalg-eigen',
    category: '선형대수',
    name: '고유값과 고유벡터 방정식',
    description: '선형변환의 고유값 문제와 특성방정식',
    latex: 'A\\mathbf{v} = \\lambda\\mathbf{v}, \\quad \\det(A - \\lambda I) = 0',
    isBlock: true,
  },
  {
    id: 'math-linalg-svd',
    category: '선형대수',
    name: '특이값 분해 (SVD)',
    description: '임의의 행렬을 직교행렬과 대각행렬의 곱으로 분해',
    latex: 'A = U \\Sigma V^{T}',
    isBlock: true,
  },
  {
    id: 'math-linalg-dot-norm',
    category: '선형대수',
    name: '벡터 내적과 유클리드 노름',
    description: '두 벡터의 내적과 L2 거리 크기 정의',
    latex: '\\langle \\mathbf{u}, \\mathbf{v} \\rangle = \\mathbf{u}^T \\mathbf{v}, \\quad \\|\\mathbf{x}\\|_2 = \\sqrt{\\sum_{i=1}^{n} x_i^2}',
    isBlock: true,
  },
  {
    id: 'math-linalg-system',
    category: '선형대수',
    name: '연립 선형방정식',
    description: '3원 일차 연립방정식 중괄호 표기',
    latex: '\\begin{cases} 2x + 3y - z = 5 \\\\ x - 2y + 4z = -3 \\\\ 3x + y + 2z = 7 \\end{cases}',
    isBlock: true,
  },

  // 5. 물리 (6개)
  {
    id: 'math-phys-newton',
    category: '물리',
    name: '뉴턴 운동 제2법칙',
    description: '힘, 운동량의 시간 변화율, 가속도의 관계',
    latex: '\\mathbf{F} = \\frac{d\\mathbf{p}}{dt} = m\\mathbf{a}',
    isBlock: true,
  },
  {
    id: 'math-phys-einstein',
    category: '물리',
    name: '상대론적 에너지-운동량 관계',
    description: '정지 질량과 운동량을 포함한 특수상대성이론 에너지 공식',
    latex: 'E = \\sqrt{(pc)^2 + (m_0 c^2)^2}',
    isBlock: true,
  },
  {
    id: 'math-phys-schrodinger',
    category: '물리',
    name: '시간 의존 슈뢰딩거 방정식',
    description: '양자역학에서 파동함수의 시간 진화를 기술하는 방정식',
    latex: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r}, t) = \\left( -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r}, t) \\right)\\Psi(\\mathbf{r}, t)',
    isBlock: true,
  },
  {
    id: 'math-phys-maxwell',
    category: '물리',
    name: '맥스웰 전자기장 방정식',
    description: '가우스 법칙과 앙페르-맥스웰 법칙의 미분형',
    latex: '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}, \\quad \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}',
    isBlock: true,
  },
  {
    id: 'math-phys-gravity',
    category: '물리',
    name: '만유인력의 법칙',
    description: '두 질량 사이의 중력 크기 공식',
    latex: 'F = G \\frac{m_1 m_2}{r^2}',
    isBlock: true,
  },
  {
    id: 'math-phys-thermo',
    category: '물리',
    name: '이상기체 상태방정식',
    description: '압력, 부피, 몰수, 절대온도의 열역학 관계식',
    latex: 'PV = nRT = Nk_B T',
    isBlock: false,
  },

  // 6. 화학식·기호 (6개)
  {
    id: 'math-chem-water',
    category: '화학식·기호',
    name: '물의 합성 반응식',
    description: '수소와 산소 기체로부터 물이 생성되는 화학 반응식',
    latex: '2\\text{H}_2 + \\text{O}_2 \\longrightarrow 2\\text{H}_2\\text{O}',
    isBlock: true,
  },
  {
    id: 'math-chem-equilibrium',
    category: '화학식·기호',
    name: '가역 반응과 평형 상수',
    description: '화학 평형 반응식과 농도 평형 상수 Kc 정의',
    latex: 'a\\text{A} + b\\text{B} \\rightleftharpoons c\\text{C} + d\\text{D}, \\quad K_c = \\frac{[\\text{C}]^c[\\text{D}]^d}{[\\text{A}]^a[\\text{B}]^b}',
    isBlock: true,
  },
  {
    id: 'math-chem-ph',
    category: '화학식·기호',
    name: '수소 이온 농도 지수 (pH)',
    description: '수용액의 산성도를 나타내는 로그 공식',
    latex: '\\text{pH} = -\\log_{10}[\\text{H}_3\\text{O}^+]',
    isBlock: true,
  },
  {
    id: 'math-chem-arrhenius',
    category: '화학식·기호',
    name: '아레니우스 반응 속도식',
    description: '활성화 에너지와 온도에 따른 반응 속도 상수',
    latex: 'k = A \\exp\\left(-\\frac{E_a}{RT}\\right)',
    isBlock: true,
  },
  {
    id: 'math-chem-gibbs',
    category: '화학식·기호',
    name: '깁스 자유 에너지',
    description: '엔탈피, 엔트로피, 온도를 통한 반응 자발성 판별식',
    latex: '\\Delta G = \\Delta H - T\\Delta S',
    isBlock: true,
  },
  {
    id: 'math-chem-greek',
    category: '화학식·기호',
    name: '자주 쓰는 그리스 문자 모음',
    description: '수식과 과학 기호에 쓰이는 소문자·대문자 그리스 문자',
    latex: '\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\theta, \\lambda, \\mu, \\pi, \\sigma, \\phi, \\omega, \\Delta, \\Sigma, \\Omega',
    isBlock: false,
  },
] as const;
