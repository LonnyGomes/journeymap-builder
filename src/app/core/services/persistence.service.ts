import { Injectable, inject } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { JourneyMap } from '../../models/journey-map.model';
import { ToastService } from './toast.service';

interface JourneyMapDB extends DBSchema {
  journeyMaps: {
    key: string;
    value: JourneyMap;
    indexes: { 'by-updated': Date };
  };
}

const DB_NAME = 'journeymap-builder';
const DB_VERSION = 1;
const STORE_NAME = 'journeyMaps';
const CURRENT_MAP_KEY = 'current';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private toastService = inject(ToastService);
  private db: IDBPDatabase<JourneyMapDB> | null = null;

  async init(): Promise<void> {
    try {
      this.db = await openDB<JourneyMapDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        },
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.toastService.error('Failed to initialize local storage');
    }
  }

  async saveMap(map: JourneyMap): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      if (this.db) {
        // Store the map with a fixed key for "current" map
        const mapToSave = {
          ...map,
          id: CURRENT_MAP_KEY,
          createdAt: map.createdAt instanceof Date ? map.createdAt : new Date(map.createdAt),
          updatedAt: new Date(),
        };
        await this.db.put(STORE_NAME, mapToSave);
      }
    } catch (error) {
      console.error('Failed to save map:', error);
      this.toastService.error('Failed to save changes');
    }
  }

  async loadMap(): Promise<JourneyMap | null> {
    if (!this.db) {
      await this.init();
    }

    try {
      if (this.db) {
        const map = await this.db.get(STORE_NAME, CURRENT_MAP_KEY);
        if (map) {
          // Convert stored dates back to Date objects
          return {
            ...map,
            createdAt: new Date(map.createdAt),
            updatedAt: new Date(map.updatedAt),
          };
        }
      }
    } catch (error) {
      console.error('Failed to load map:', error);
      this.toastService.error('Failed to load saved data');
    }

    return null;
  }

  async clearMap(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      if (this.db) {
        await this.db.delete(STORE_NAME, CURRENT_MAP_KEY);
      }
    } catch (error) {
      console.error('Failed to clear map:', error);
    }
  }
}
