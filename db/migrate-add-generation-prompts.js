const { db, run } = require('../lib/db');

async function migrate() {
    console.log('Creating generation_prompts and generation_prompt_files tables if missing...');
    await run(`
        CREATE TABLE IF NOT EXISTS generation_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            prompt_text TEXT NOT NULL DEFAULT '',
            content_hash TEXT NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0,
            last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(course_id, content_hash)
        )
    `);
    await run(`
        CREATE TABLE IF NOT EXISTS generation_prompt_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_id INTEGER NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100),
            byte_size INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            content_hash TEXT NOT NULL,
            FOREIGN KEY (prompt_id) REFERENCES generation_prompts(id) ON DELETE CASCADE
        )
    `);
    await run('CREATE INDEX IF NOT EXISTS idx_generation_prompts_course ON generation_prompts(course_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_generation_prompts_last_used ON generation_prompts(last_used_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_generation_prompt_files_prompt ON generation_prompt_files(prompt_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_generation_prompt_files_hash ON generation_prompt_files(content_hash)');
    console.log('generation_prompts tables ready.');
}

migrate()
    .then(() => {
        db.close();
        console.log('Done.');
    })
    .catch((err) => {
        console.error(err);
        db.close();
        process.exit(1);
    });
