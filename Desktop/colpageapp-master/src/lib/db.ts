import Dexie, { type Table } from 'dexie';

export interface ImageRecord {
  filename: string;
  blob: Blob;
}

export class AppDatabase extends Dexie {
  images!: Table<ImageRecord>;

  constructor() {
    super('AppDatabase');
    this.version(1).stores({
      images: 'filename, blob'
    });
  }
}

export const db = new AppDatabase();
