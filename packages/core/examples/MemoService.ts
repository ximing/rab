import { Service } from '../src/decorator/service';

@Service()
export class MemoService {
  private memos: string[] = [];

  async addMemo(memo: string): Promise<void> {
    this.memos.push(memo);
  }

  getMemos(): string[] {
    return this.memos;
  }
}
