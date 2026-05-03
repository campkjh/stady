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

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
