import type { DocumentTemplate } from './types';

export const STUDY_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'study-notes',
    category: '학습',
    name: '학습 노트',
    description: '주제, 핵심 개념, 수식 블록, 코드 예제, 질문 및 요약',
    content: `# 학습 노트: (학습 주제)

## 핵심 개념
- (학습한 핵심 개념 1에 대한 요약)
- (학습한 핵심 개념 2에 대한 요약)

## 수식 및 정리
정규 분포(가우스 분포)의 확률 밀도 함수:

$$
f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}
$$

- $x$: 확률 변수
- $\\mu$: 기댓값(평균)
- $\\sigma$: 표준편차

## 예제 코드 및 풀이
\`\`\`ts
// 개념을 적용한 간단한 구현 예제
function calculateProbability(x: number, mean: number, stdDev: number): number {
  const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
  const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
  return coefficient * Math.exp(exponent);
}
\`\`\`

## 질문 및 추가 학습 과제
- [ ] (이해를 보완해야 하는 질문 1)
- [ ] (연계하여 공부할 관련 알고리즘)

## 요약
- (학습한 내용에 대한 1~2줄 핵심 요약)
`,
  },
  {
    id: 'cornell-notes',
    category: '학습',
    name: '강의 노트(코넬식)',
    description: '단서(Cue), 필기(Notes), 요약(Summary) 영역으로 구조화된 코넬식 노트 필기법',
    content: `# 코넬식 강의 노트: (강의명)

## 강의 기본 정보
| 항목 | 내용 |
| --- | --- |
| 강의 주제 | (예: 알고리즘 설계와 시간 복잡도 분석) |
| 교수/강사 | ○○○ 교수님 |
| 일시 / 주차 | {{날짜}} / 5주차 |

## 단서 및 필기 영역
| 단서 및 질문 (Cue Column) | 강의 필기 내용 (Note-taking Column) |
| --- | --- |
| **Big-O 표기법이란?** | 점근적 표기법으로 최악의 경우 수행 시간 상한을 나타내며, 입력 크기 $n$ 증가에 따른 연산 추세를 분석함 |
| **분할 정복(Divide & Conquer)** | 문제를 작은 하위 문제로 분할해 해결한 뒤 병합하는 기법 (예: 병합 정렬 $O(n \\log n)$) |
| **피해야 할 실수?** | 최선 표기법($\\Omega$)과 평균 표기법($\\Theta$)의 혼동 주의, 재귀 호출 스택의 공간 복잡도 고려 필수 |

## 핵심 요약 (Summary)
> [!NOTE]
> 강의 종료 후 24시간 이내에 3~4줄로 핵심을 요약합니다.
- 알고리즘 성능 평가는 단순 실행 시간이 아닌 입력 크기 대비 연산 횟수의 점근적 증가율로 측정한다.
- 분할 정복은 문제를 독립된 부분으로 쪼갤 수 있을 때 강력한 효율을 보이며 마스터 정리를 통해 시간 복잡도를 쉽게 도출할 수 있다.

## 복습 체크리스트
- [ ] 단서 열만 보고 필기 내용을 스스로 설명할 수 있는가?
- [ ] 마스터 정리(Master Theorem) 예제 3문제 직접 손으로 풀기
`,
  },
  {
    id: 'exam-prep-summary',
    category: '학습',
    name: '시험 대비 정리',
    description: '시험 범위, 빈출 개념, 혼동하기 쉬운 내용 비교 및 오답 노트를 담은 최종 정리본',
    content: `# 시험 대비 핵심 정리: (과목명)

## 1. 시험 개요
| 항목 | 내용 |
| --- | --- |
| 과목명 | (과목명 입력) |
| 시험 일시 | {{날짜}} 10:00 (D-Day 카운트다운) |
| 출제 범위 | 교재 3장 ~ 7장, 배포 유인물 전 범위 |
| 목표 성적 | A+ (95점 이상) |

## 2. 빈출 핵심 개념 요약
### 1) 관계형 데이터베이스 정규화 (Normalization)
- **제1정규형 (1NF)**: 모든 속성의 도메인이 원자값(Atomic Value)이어야 함.
- **제2정규형 (2NF)**: 제1정규형 만족 + 부분 함수적 종속성 제거 (완전 함수적 종속).
- **제3정규형 (3NF)**: 제2정규형 만족 + 이행적 함수 종속성($A \\rightarrow B, B \\rightarrow C$) 제거.

### 2) 인덱스(Index) 동작 원리
- B+Tree 구조 기반 탐색 시간 복잡도: $O(\\log N)$
- 카디널리티(Cardinality)가 높은 컬럼에 인덱스를 생성하는 것이 유리함.

## 3. 혼동하기 쉬운 개념 비교 표
| 비교 항목 | 클러스터드 인덱스 (Clustered) | 넌클러스터드 인덱스 (Non-clustered) |
| --- | --- | --- |
| 정렬 상태 | 물리적으로 테이블 데이터가 정렬됨 | 별도의 인덱스 페이지에 정렬 저장됨 |
| 테이블당 개수 | 오직 1개만 존재 가능 (기본키 등) | 여러 개 생성 가능 (일반적으로 4~5개 권장) |
| 검색 속도 | 범위 검색(Range Scan)에 매우 유리 | 단건 조회에 적합하나 리프 노드 참조 필요 |

## 4. 오답 노트 및 주의할 점
> [!WARNING]
> 트랜잭션의 격리 수준(Isolation Level) 4단계와 각 단계에서 발생하는 이상 현상(Dirty Read, Non-repeatable Read, Phantom Read) 매핑 표를 반드시 암기할 것!

## 5. D-Day 최종 점검 체크리스트
- [ ] 기출문제 최근 3개년 풀이 및 오답 체크
- [ ] 계산 공식(페이징 수식, 조인 비용 등) 백지에 안 보고 써보기
- [ ] 신분증, 수험표, 컴퓨터용 사인펜 준비
`,
  },
  {
    id: 'vocabulary-sheet',
    category: '학습',
    name: '단어장(표)',
    description: '단어, 품사/발음, 뜻, 예문, 암기 상태 체크박스를 갖춘 어휘 암기장',
    content: `# 어휘 학습 단어장: (언어/분야명)

> [!NOTE]
> 학습 일자: {{날짜}} | 목표 단어: 15개 | 복습 주기: 에빙하우스 망각곡선 (1일, 3일, 7일 후)

## 단어 암기 목록
| No | 단어 (Word) | 품사 / 발음 | 의미 및 뜻 | 예문 (Context) | 암기 상태 |
| :---: | --- | :---: | --- | --- | :---: |
| 1 | **ubiquitous** | adj. [juːˈbɪkwɪtəs] | 어디에나 있는, 흔한 | Smartphones have become **ubiquitous** in modern life. | 완료 |
| 2 | **resilient** | adj. [rɪˈzɪliənt] | 회복력 있는, 탄력적인 | The local economy proved remarkably **resilient**. | 완료 |
| 3 | **pragmatic** | adj. [præɡˈmætɪk] | 실용적인, 현실적인 | We need to take a **pragmatic** approach to this problem. | 학습 중 |
| 4 | **ephemeral** | adj. [ɪˈfemərəl] | 덧없는, 일시적인 | Fashions are **ephemeral**, but style remains. | 학습 중 |
| 5 | **meticulous** | adj. [məˈtɪkjələs] | 꼼꼼한, 세심한 | He was **meticulous** about keeping accurate records. | 완료 |

## 주요 어근 및 파생어 정리
- **-scribe / -script (쓰다, 기록하다)**:
  - *describe* (묘사하다)
  - *prescribe* (처방하다, 규정하다)
  - *subscribe* (구독하다, 동의하다)
  - *transcript* (사본, 성적증명서)

## 복습 주기 체크
- [x] 1일차 복습 (단어 가리고 뜻 맞추기)
- [ ] 3일차 복습 (예문 영작해보기)
- [ ] 7일차 복습 (누적 테스트)
`,
  },
  {
    id: 'paper-reading-notes',
    category: '학습',
    name: '논문 읽기 노트',
    description: '연구 배경, 핵심 기여(Contributions), 방법론, 실험 결과 및 한계점 분석',
    content: `# 논문 읽기 노트: (논문 제목)

## 1. 논문 서지 정보
| 항목 | 내용 |
| --- | --- |
| 논문 제목 | Attention Is All You Need |
| 저자 | Vaswani et al. (Google Brain / Google Research) |
| 학회 / 저널 | NeurIPS 2017 |
| 읽은 일자 | {{날짜}} |
| 논문 링크 | [arXiv:1706.03762](https://arxiv.org/abs/1706.03762) |

## 2. 연구 배경 및 문제 정의
- **기존 방식의 한계**: RNN 및 LSTM 모델은 순차적 계산 특성상 병렬화가 불가능하여 대규모 데이터 학습 시 심각한 병목 현상이 발생함.
- **장거리 의존성(Long-range Dependencies)**: 문장 길이가 길어질수록 초기 토큰의 정보가 손실되는 그래디언트 소실 문제가 상존함.

## 3. 핵심 아이디어 및 방법론 (Contributions)
- 재귀(Recurrence)와 합성곱(Convolution)을 완전히 배제하고 오직 **어텐션 메커니즘(Self-Attention)**만으로 모델을 구성.
- **Multi-Head Attention**: 서로 다른 위치의 다양한 표현 부분 공간(Representation Subspaces) 정보를 포착할 수 있도록 다중 헤드 구성.

**Scaled Dot-Product Attention 수식**:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

## 4. 실험 결과 요약
| 모델 | WMT 2014 En-De BLEU | WMT 2014 En-Fr BLEU | 학습 소요 비용 (FLOPs) |
| --- | :---: | :---: | :---: |
| 기존 SOTA (ConvS2S) | 25.16 | 40.46 | $9.6 \\times 10^{18}$ |
| **Transformer (base)** | 27.3 | 38.1 | $3.3 \\times 10^{18}$ |
| **Transformer (big)** | **28.4** | **41.8** | $2.3 \\times 10^{19}$ |

## 5. 논문의 한계점 및 내 연구에의 시사점
> [!TIP]
> 계산 복잡도가 시퀀스 길이 $n$의 제곱($O(n^2)$)에 비례하므로 긴 문서 처리 시 효율적인 Sparse Attention 또는 선형 어텐션 기법과 결합하는 연구를 고려해볼 만합니다.
`,
  },
  {
    id: 'math-formula-reference',
    category: '학습',
    name: '수학 공식 정리(수식 KaTeX)',
    description: '미적분학, 선형대수, 확률과 통계의 주요 정리와 수식을 체계적으로 정리한 레퍼런스',
    content: `# 수학 핵심 공식 정리집

수학 및 데이터 과학에서 자주 활용되는 필수 공식 모음입니다.

## 1. 미적분학 (Calculus)

### 미적분학의 기본 정리 (Fundamental Theorem of Calculus)
함수 $f$가 닫힌 구간 $[a, b]$에서 연속이고 $F$가 $f$의 역도함수일 때:

$$
\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)
$$

### 테일러 급수 (Taylor Series)
점 $a$ 근방에서 무한 번 미분 가능한 함수 $f(x)$의 전개:

$$
f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x - a)^n = f(a) + f'(a)(x-a) + \\frac{f''(a)}{2!}(x-a)^2 + \\cdots
$$

---

## 2. 대수학 및 기하학 (Algebra & Geometry)

### 이차방정식의 근의 공식
방정식 $ax^2 + bx + c = 0$ ($a \\neq 0$)의 해:

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

### 오일러 등식 (Euler's Identity)
세상에서 가장 아름다운 공식으로 불리는 관계식:

$$
e^{i\\pi} + 1 = 0
$$

---

## 3. 선형대수학 및 통계 (Linear Algebra & Statistics)

### 베이즈 정리 (Bayes' Theorem)
사전 확률 $P(A)$와 우도 $P(B|A)$로부터 사후 확률 $P(A|B)$ 도출:

$$
P(A|B) = \\frac{P(B|A) P(A)}{P(B)} = \\frac{P(B|A) P(A)}{\\sum_{i} P(B|A_i) P(A_i)}
$$

### 고윳값과 고유벡터 (Eigenvalues & Eigenvectors)
정방행렬 $A$와 0이 아닌 벡터 $v$, 스칼라 $\\lambda$:

$$
A\\mathbf{v} = \\lambda\\mathbf{v} \\quad \\Longleftrightarrow \\quad \\det(A - \\lambda I) = 0
$$

> [!NOTE]
> KaTeX 수식은 인라인 형태($E = mc^2$)와 블록 형태(\`$$ ... $$\`)로 마크다운 내에서 자유롭게 표기할 수 있습니다.
`,
  },
];
