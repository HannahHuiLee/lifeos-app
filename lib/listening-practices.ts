export type ListeningTurn = {
  speaker: string;
  text: string;
};

export type ListeningPractice = {
  id: string;
  title: string;
  level: string;
  audioSrc: string;
  turns: ListeningTurn[];
  reference: {
    mainIdea: string;
    who: string;
    whatHappened: string;
    why: string;
    whatsNext: string;
  };
};

// 这里把素材设计成数组，即使 MVP 只有一段，以后加入素材选择也只需继续添加对象。
// 加入第一段固定听力素材。
export const listeningPractices: ListeningPractice[] = [
  {
    id: 'team-picnic-ride',
    title: 'A Ride to the Team Picnic',
    level: 'A2–B1',
    audioSrc: '/audio/team-picnic-ride.mp3',
    turns: [
      {
        speaker: 'Maya',
        text: 'Hey Daniel, are you still coming to the team picnic on Saturday?',
      },
      {
        speaker: 'Daniel',
        text: 'I was planning to, but my car is at the mechanic.',
      },
      {
        speaker: 'Maya',
        text: 'Oh no. What happened?',
      },
      {
        speaker: 'Daniel',
        text: 'The engine warning light came on yesterday. They need to keep the car until Monday.',
      },
      {
        speaker: 'Maya',
        text: 'You can ride with me. I am leaving at ten, and the picnic starts at eleven.',
      },
      {
        speaker: 'Daniel',
        text: 'That would be great. Can you pick me up near the train station?',
      },
      {
        speaker: 'Maya',
        text: 'Sure. Text me the exact address tonight.',
      },
      {
        speaker: 'Daniel',
        text: 'Thanks. I will bring dessert, then.',
      },
    ],
    reference: {
      mainIdea:
        'Daniel needs transportation to the team picnic, and Maya offers him a ride.',
      who: 'Maya and Daniel',
      whatHappened:
        'Daniel cannot drive because his car is at the mechanic, so Maya offers to take him.',
      why:
        'The engine warning light came on, and the mechanic must keep the car until Monday.',
      whatsNext:
        'Daniel will text Maya his address, Maya will pick him up, and Daniel will bring dessert.',
    },
  },
];

export function getListeningPractice(
  id: string
): ListeningPractice | undefined {
  return listeningPractices.find((practice) => practice.id === id);
}