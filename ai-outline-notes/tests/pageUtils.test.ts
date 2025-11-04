import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';

import type { Page, PageVisit } from '../src/types';

type NotesDb = typeof import('../src/db/database').db;

const pageVisits: PageVisit[] = [];
const pages = new Map<string, Page>();

const resetMockDb = () => {
  pageVisits.length = 0;
  pages.clear();
};

const cloneVisit = (visit: PageVisit): PageVisit => ({ ...visit });

const mockDb = {
  pageVisits: {
    async add(visit: PageVisit) {
      pageVisits.push(cloneVisit(visit));
    },
    async bulkDelete(ids: string[]) {
      for (const id of ids) {
        const index = pageVisits.findIndex(visit => visit.id === id);
        if (index >= 0) {
          pageVisits.splice(index, 1);
        }
      }
    },
    async update(id: string, changes: Partial<PageVisit>) {
      const target = pageVisits.find(visit => visit.id === id);
      if (!target) {
        return 0;
      }
      Object.assign(target, changes);
      return 1;
    },
    where({ pageId }: { pageId: string }) {
      return {
        async toArray() {
          return pageVisits.filter(visit => visit.pageId === pageId).map(cloneVisit);
        },
        async first() {
          const match = pageVisits.find(visit => visit.pageId === pageId);
          return match ? cloneVisit(match) : undefined;
        },
      };
    },
    orderBy(field: string) {
      if (field !== 'visitedAt') {
        throw new Error(`Unsupported order field: ${field}`);
      }
      return {
        reverse() {
          return {
            async toArray() {
              return [...pageVisits]
                .sort((a, b) => a.visitedAt - b.visitedAt)
                .reverse()
                .map(cloneVisit);
            },
          };
        },
      };
    },
  },
  pages: {
    async add(page: Page) {
      pages.set(page.id, { ...page });
    },
    async get(id: string) {
      const page = pages.get(id);
      return page ? { ...page } : undefined;
    },
    async clear() {
      pages.clear();
    },
  },
};

const {
  recordPageVisit,
  getRecentPages,
  __setPageUtilsDb,
  __resetPageUtilsDb,
} = await import('../src/utils/pageUtils.ts');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function addPage(page: Page) {
  await mockDb.pages.add(page);
}

resetMockDb();
__setPageUtilsDb(mockDb as unknown as NotesDb);

describe('page visit utilities', () => {
  beforeEach(() => {
    resetMockDb();
    __setPageUtilsDb(mockDb as unknown as NotesDb);
  });

  after(() => {
    __resetPageUtilsDb();
  });

  it('updates the visit timestamp when revisiting the same page instead of duplicating records', async () => {
    const now = Date.now();
    const page: Page = {
      id: 'page-1',
      title: 'Page One',
      type: 'note',
      isReference: false,
      createdAt: now,
      updatedAt: now,
    };

    await addPage(page);

    await recordPageVisit(page.id);
    const firstVisit = await mockDb.pageVisits.where({ pageId: page.id }).first();
    assert.ok(firstVisit);
    const firstVisitedAt = firstVisit.visitedAt;

    await delay(5);
    await recordPageVisit(page.id);

    const visitsForPage = await mockDb.pageVisits.where({ pageId: page.id }).toArray();
    assert.strictEqual(visitsForPage.length, 1);
    assert.ok(visitsForPage[0].visitedAt > firstVisitedAt);
  });

  it('returns recent pages in order without duplicates', async () => {
    const timestamp = Date.now();
    const basePage: Omit<Page, 'id' | 'title'> = {
      type: 'note',
      isReference: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await addPage({ ...basePage, id: 'page-1', title: 'Alpha' });
    await addPage({ ...basePage, id: 'page-2', title: 'Beta' });
    await addPage({ ...basePage, id: 'page-3', title: 'Gamma' });

    await recordPageVisit('page-1');
    await delay(5);
    await recordPageVisit('page-2');
    await delay(5);
    await recordPageVisit('page-1');

    const recentPages = await getRecentPages(5);
    assert.deepStrictEqual(recentPages.map(page => page.id), ['page-1', 'page-2']);

    const limitedPages = await getRecentPages(1);
    assert.strictEqual(limitedPages.length, 1);
    assert.strictEqual(limitedPages[0].id, 'page-1');
  });
});
