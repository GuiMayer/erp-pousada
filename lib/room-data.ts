export type RoomStatus = "livre" | "ocupado" | "manutencao"

export type TimelineDay = {
  date: string
  label: string
  status: RoomStatus
}

export type Room = {
  id: number
  number: string
  type: string
  status: RoomStatus
  guest?: string
  checkIn?: string
  checkOut?: string
  timeline: TimelineDay[]
}

function getDateLabel(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const day = date.getDate()
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${day} ${months[date.getMonth()]}`
}

function getDateISO(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split("T")[0]
}

function generateTimeline(pattern: RoomStatus[]): TimelineDay[] {
  return pattern.map((status, i) => ({
    date: getDateISO(i),
    label: getDateLabel(i),
    status,
  }))
}

export const rooms: Room[] = [
  {
    id: 1,
    number: "101",
    type: "Standard",
    status: "ocupado",
    guest: "Carlos Mendes",
    checkIn: getDateISO(-2),
    checkOut: getDateISO(3),
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "livre", "livre", "livre"]),
  },
  {
    id: 2,
    number: "102",
    type: "Standard",
    status: "livre",
    timeline: generateTimeline(["livre", "livre", "ocupado", "ocupado", "ocupado", "livre", "livre"]),
  },
  {
    id: 3,
    number: "103",
    type: "Luxo",
    status: "ocupado",
    guest: "Ana Beatriz Silva",
    checkIn: getDateISO(-1),
    checkOut: getDateISO(4),
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "livre", "livre"]),
  },
  {
    id: 4,
    number: "104",
    type: "Luxo",
    status: "manutencao",
    timeline: generateTimeline(["manutencao", "manutencao", "livre", "livre", "ocupado", "ocupado", "ocupado"]),
  },
  {
    id: 5,
    number: "201",
    type: "Suite",
    status: "livre",
    timeline: generateTimeline(["livre", "livre", "livre", "ocupado", "ocupado", "ocupado", "livre"]),
  },
  {
    id: 6,
    number: "202",
    type: "Suite",
    status: "ocupado",
    guest: "Roberto Almeida",
    checkIn: getDateISO(-3),
    checkOut: getDateISO(1),
    timeline: generateTimeline(["ocupado", "ocupado", "livre", "livre", "livre", "ocupado", "ocupado"]),
  },
  {
    id: 7,
    number: "203",
    type: "Standard",
    status: "livre",
    timeline: generateTimeline(["livre", "ocupado", "ocupado", "ocupado", "livre", "livre", "livre"]),
  },
  {
    id: 8,
    number: "204",
    type: "Luxo",
    status: "ocupado",
    guest: "Juliana Costa",
    checkIn: getDateISO(-1),
    checkOut: getDateISO(5),
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "livre"]),
  },
  {
    id: 9,
    number: "301",
    type: "Suite Master",
    status: "livre",
    timeline: generateTimeline(["livre", "livre", "livre", "livre", "ocupado", "ocupado", "ocupado"]),
  },
  {
    id: 10,
    number: "302",
    type: "Suite Master",
    status: "manutencao",
    timeline: generateTimeline(["manutencao", "manutencao", "manutencao", "livre", "livre", "livre", "livre"]),
  },
  {
    id: 11,
    number: "303",
    type: "Standard",
    status: "ocupado",
    guest: "Fernanda Lima",
    checkIn: getDateISO(0),
    checkOut: getDateISO(6),
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado"]),
  },
  {
    id: 12,
    number: "304",
    type: "Luxo",
    status: "livre",
    timeline: generateTimeline(["livre", "livre", "livre", "livre", "livre", "ocupado", "ocupado"]),
  },
]
