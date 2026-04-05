import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@stady.com" },
    update: {},
    create: {
      email: "admin@stady.com",
      password: "admin1234",
      nickname: "관리자",
      role: "admin",
    },
  });

  // Create test user
  const user1 = await prisma.user.upsert({
    where: { email: "user@stady.com" },
    update: {},
    create: {
      email: "user@stady.com",
      password: "user1234",
      nickname: "진실한라마118",
      role: "user",
    },
  });

  // Create sample users for rankings
  const user2 = await prisma.user.upsert({
    where: { email: "user2@stady.com" },
    update: {},
    create: { email: "user2@stady.com", password: "user1234", nickname: "꿍꿍 펭귄", role: "user" },
  });
  const user3 = await prisma.user.upsert({
    where: { email: "user3@stady.com" },
    update: {},
    create: { email: "user3@stady.com", password: "user1234", nickname: "다롱다솜", role: "user" },
  });
  const user4 = await prisma.user.upsert({
    where: { email: "user4@stady.com" },
    update: {},
    create: { email: "user4@stady.com", password: "user1234", nickname: "외눈박이 도깨비", role: "user" },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: "전체", icon: "/icons/전체.svg", order: 0 } }),
    prisma.category.create({ data: { name: "생활과윤리", icon: "/icons/생활과윤리.svg", order: 1 } }),
    prisma.category.create({ data: { name: "사회문화", icon: "/icons/사회문화.svg", order: 2 } }),
    prisma.category.create({ data: { name: "윤리와사상", icon: "/icons/윤리와사상.svg", order: 3 } }),
    prisma.category.create({ data: { name: "한국지리", icon: "/icons/한국지리.svg", order: 4 } }),
    prisma.category.create({ data: { name: "세계지리", icon: "/icons/세계지리.svg", order: 5 } }),
    prisma.category.create({ data: { name: "정치와법", icon: "/icons/정치와법.svg", order: 6 } }),
    prisma.category.create({ data: { name: "영어", icon: "/icons/영어.svg", order: 7 } }),
  ]);

  const cat생활 = categories[1];
  const cat사회 = categories[2];
  const cat영어 = categories[7];

  // Create workbooks
  const workbook1 = await prisma.workbook.create({
    data: {
      title: "올리드 생활과 윤리",
      categoryId: cat생활.id,
      totalQuestions: 5,
      questionPerPage: 12,
    },
  });

  const workbook2 = await prisma.workbook.create({
    data: {
      title: "쎈 중등 수학 1-2",
      categoryId: cat사회.id,
      totalQuestions: 5,
      questionPerPage: 12,
    },
  });

  const workbook3 = await prisma.workbook.create({
    data: {
      title: "자이스토리",
      categoryId: cat생활.id,
      totalQuestions: 5,
      questionPerPage: 12,
    },
  });

  // Create problems for workbook1
  const passages = [
    "글을 읽고 그 의미를 이해하는 독해에는 글의 유형이나 독서 흥미 등의 다양한 요소가 영향을 미칠 수 있다. 이를 고려하여 독해 능력을 복잡한 과정으로 설명한 연구가 많다.",
    "현대 사회에서 윤리적 소비란 소비자가 상품이나 서비스를 구매할 때 윤리적 가치를 고려하여 선택하는 행위를 말한다.",
  ];

  for (let i = 1; i <= 5; i++) {
    await prisma.problem.create({
      data: {
        workbookId: workbook1.id,
        order: i,
        questionText: `다음 글을 읽고 물음에 답하시오. (문제 ${i})`,
        passageImage: null,
        choice1: `${i}번 문제 보기 ①`,
        choice2: `${i}번 문제 보기 ②`,
        choice3: `${i}번 문제 보기 ③`,
        choice4: `${i}번 문제 보기 ④`,
        choice5: `${i}번 문제 보기 ⑤`,
        answer: ((i % 5) + 1),
        explanation: `${i}번 문제의 정답은 ${(i % 5) + 1}번입니다. 이 문제는 지문의 핵심 내용을 파악하는 능력을 측정합니다.`,
      },
    });
  }

  // Create problems for workbook2 & 3
  for (const wb of [workbook2, workbook3]) {
    for (let i = 1; i <= 5; i++) {
      await prisma.problem.create({
        data: {
          workbookId: wb.id,
          order: i,
          questionText: `${wb.title} - 문제 ${i}`,
          choice1: "보기 ①",
          choice2: "보기 ②",
          choice3: "보기 ③",
          choice4: "보기 ④",
          choice5: "보기 ⑤",
          answer: ((i % 5) + 1),
          explanation: `정답: ${(i % 5) + 1}번`,
        },
      });
    }
  }

  // Create quiz attempts for rankings
  await prisma.quizAttempt.create({
    data: { userId: user2.id, quizType: "workbook", workbookId: workbook1.id, score: 100, totalScore: 100, timeTaken: 792 },
  });
  await prisma.quizAttempt.create({
    data: { userId: user3.id, quizType: "workbook", workbookId: workbook1.id, score: 100, totalScore: 100, timeTaken: 812 },
  });
  await prisma.quizAttempt.create({
    data: { userId: user4.id, quizType: "workbook", workbookId: workbook1.id, score: 54, totalScore: 100, timeTaken: 2204 },
  });

  // Create OX quiz sets
  const oxSet1 = await prisma.oxQuizSet.create({
    data: {
      title: "한국사 OX 퀴즈",
      categoryId: cat사회.id,
      difficulty: "보통",
      totalQuestions: 5,
    },
  });

  const oxQuestions = [
    { question: "63빌딩은 88 서울 올림픽 이후에 세워졌다.", answer: false },
    { question: "한글은 세종대왕이 창제하였다.", answer: true },
    { question: "대한민국의 수도는 서울이다.", answer: true },
    { question: "독도는 울릉도보다 면적이 크다.", answer: false },
    { question: "경복궁은 조선시대에 지어졌다.", answer: true },
  ];

  for (let i = 0; i < oxQuestions.length; i++) {
    await prisma.oxQuestion.create({
      data: {
        oxQuizSetId: oxSet1.id,
        order: i + 1,
        question: oxQuestions[i].question,
        answer: oxQuestions[i].answer,
        explanation: oxQuestions[i].answer ? "정답은 O(그렇다)입니다." : "정답은 X(아니다)입니다.",
      },
    });
  }

  // Create vocab quiz sets
  const vocabSet1 = await prisma.vocabQuizSet.create({
    data: {
      title: "중학 필수 영단어",
      categoryId: cat영어.id,
      difficulty: "쉬움",
      totalQuestions: 5,
    },
  });

  const vocabQuestions = [
    { word: '"당황한"에 가장 가까운 영어 표현은 무엇일까요?', choices: ["Furious", "Embarrassed", "Relaxed", "Proud"], answer: 2 },
    { word: '"용감한"에 가장 가까운 영어 표현은 무엇일까요?', choices: ["Timid", "Brave", "Lazy", "Angry"], answer: 2 },
    { word: '"호기심"에 가장 가까운 영어 표현은 무엇일까요?', choices: ["Curiosity", "Anxiety", "Jealousy", "Sympathy"], answer: 1 },
    { word: '"감사하는"에 가장 가까운 영어 표현은 무엇일까요?', choices: ["Grateful", "Greedy", "Graceful", "Grumpy"], answer: 1 },
    { word: '"실망한"에 가장 가까운 영어 표현은 무엇일까요?', choices: ["Delighted", "Determined", "Disappointed", "Dedicated"], answer: 3 },
  ];

  for (let i = 0; i < vocabQuestions.length; i++) {
    await prisma.vocabQuestion.create({
      data: {
        vocabQuizSetId: vocabSet1.id,
        order: i + 1,
        word: vocabQuestions[i].word,
        choice1: vocabQuestions[i].choices[0],
        choice2: vocabQuestions[i].choices[1],
        choice3: vocabQuestions[i].choices[2],
        choice4: vocabQuestions[i].choices[3],
        answer: vocabQuestions[i].answer,
        explanation: `정답은 ${vocabQuestions[i].choices[vocabQuestions[i].answer - 1]}입니다.`,
      },
    });
  }

  // Create dummy reviews for workbook1
  await prisma.review.createMany({
    data: [
      {
        userId: user2.id,
        workbookId: workbook1.id,
        rating: 5,
        content: "정말 유용한 문제집이에요! 시험 대비에 큰 도움이 되었습니다.",
      },
      {
        userId: user3.id,
        workbookId: workbook1.id,
        rating: 4,
        content: "문제 구성이 알차고 해설도 자세해서 좋았습니다. 다만 난이도가 조금 높은 편이에요.",
      },
      {
        userId: user4.id,
        workbookId: workbook1.id,
        rating: 3,
        content: "괜찮은 문제집입니다. 기본 개념을 다지기에 좋아요.",
      },
      {
        userId: user2.id,
        workbookId: workbook1.id,
        rating: 5,
        content: "두 번째로 풀었는데 점수가 많이 올랐어요. 반복 학습에 추천합니다!",
      },
    ],
  });

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
