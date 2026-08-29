import { beforeEach } from 'vitest';
import {
  GRAPH_SQL_STORAGE_KEY,
  LINEAGE_SESSION_META_KEY,
  LINEAGE_SESSION_RESULT_KEY,
} from '../utils/lineageSession';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  for (const key of [
    GRAPH_SQL_STORAGE_KEY,
    LINEAGE_SESSION_META_KEY,
    LINEAGE_SESSION_RESULT_KEY,
  ]) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
});
