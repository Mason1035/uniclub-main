export interface Source { title: string; url: string; publisher: string }
export interface MarchImage {
  src: string;
  alt: string;
  caption: string;
  type: '当代遗址照片' | '历史照片' | '美术作品' | '文物照片' | '当代环境照片';
  sourceUrl: string;
  credit: string;
  usage: string;
}
export interface MarchEvent {
  id: string;
  title: string;
  dateLabel: string;
  startDate: string;
  endDate?: string;
  location: string;
  currentLocation: string;
  coordinates: [number, number];
  coordinateNote: string;
  troops: string[];
  people: string[];
  summary: string;
  background: string[];
  process: string[];
  significance: string[];
  image: MarchImage;
  sources: Source[];
  themes: string[];
  group: 'central' | 'other' | 'meeting';
  sichuan: boolean;
}
