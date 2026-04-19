import Database from 'better-sqlite3';
import path from 'path';
import { Fixture } from '../types';

const db = new Database('fixtures.db');

// Initialize the database with the tables provided by the user
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team TEXT,
      away_team TEXT,
      match_time TEXT,
      competition TEXT,
      source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixture_broadcasters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER REFERENCES fixtures(id) ON DELETE CASCADE,
      broadcaster_name TEXT,
      broadcaster_country TEXT
    );
  `);
}

export function saveFixtures(fixtures: Fixture[]) {
  const insertFixture = db.prepare(`
    INSERT INTO fixtures (home_team, away_team, match_time, competition, source)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertBroadcaster = db.prepare(`
    INSERT INTO fixture_broadcasters (fixture_id, broadcaster_name)
    VALUES (?, ?)
  `);

  const deleteOld = db.transaction(() => {
    // Clear old data to avoid duplicates for simplicity in this version
    // In a real app, we'd match by teams and time
    db.prepare('DELETE FROM fixture_broadcasters').run();
    db.prepare('DELETE FROM fixtures').run();

    for (const fixture of fixtures) {
      const result = insertFixture.run(
        fixture.home_team,
        fixture.away_team,
        fixture.match_time,
        fixture.competition,
        fixture.source
      );
      
      const fixtureId = result.lastInsertRowid;
      
      if (fixture.broadcasters) {
        for (const broadcaster of fixture.broadcasters) {
          insertBroadcaster.run(fixtureId, broadcaster);
        }
      }
    }
  });

  deleteOld();
}

export function getAllFixtures(): Fixture[] {
  const fixtures = db.prepare('SELECT * FROM fixtures ORDER BY match_time ASC').all() as any[];
  
  return fixtures.map(f => {
    const broadcasters = db.prepare('SELECT broadcaster_name FROM fixture_broadcasters WHERE fixture_id = ?')
      .all(f.id) as any[];
    
    return {
      id: f.id,
      home_team: f.home_team,
      away_team: f.away_team,
      match_time: f.match_time,
      competition: f.competition,
      source: f.source,
      broadcasters: broadcasters.map(b => b.broadcaster_name)
    };
  });
}

export default db;
