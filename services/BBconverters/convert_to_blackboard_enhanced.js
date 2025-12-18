import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";
import resourceService from "../resource-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureExportsDir() {
    const dir = path.join(__dirname, "exports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function now() {
    return new Date().toISOString().replace("T", " ").replace("Z", "Z");
}

function escapeXml(v) {
    return String(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

async function loadTask(taskUid) {
    const task = await resourceService.getResource(`/task/${taskUid}`);
    if (!task || !Array.isArray(task.questions)) {
        throw new Error("Task not found or has no questions");
    }
    return task;
}

function createBlackboardXML(task) {

    const questions = task.questions
    .map(q => {
        const answers = Array.isArray(q.answers)
            ? q.answers
            : JSON.parse(q.answers || "[]");

        const correctIndex =
            typeof q.correct_index === "number"
                ? q.correct_index
                : Number(q.correct_index);

        if (
            !q.prompt ||
            !Array.isArray(answers) ||
            answers.length < 2 ||
            Number.isNaN(correctIndex)
        ) {
            return null;
        }

        return {
            ...q,
            answers,
            correct_index: correctIndex
        };
    })
    .filter(Boolean);

    if (!questions.length) {
        throw new Error("No valid questions for Blackboard export");
    }

    const questionList = questions
        .map(q => `    <QUESTION id="q${q.index}" class="QUESTION_MULTIPLECHOICE" />`)
        .join("\n");

    const questionsXml = questions.map(q => {

        const answersXml = q.answers.map((a, i) => `
    <ANSWER id="q${q.index}_a${i + 1}" position="${i + 1}">
      <DATES>
        <CREATED value="${now()}" />
        <UPDATED value="${now()}" />
      </DATES>
      <TEXT>${escapeXml(a)}</TEXT>
    </ANSWER>`).join("");

        return `
  <QUESTION_MULTIPLECHOICE id="q${q.index}">
    <DATES>
      <CREATED value="${now()}" />
      <UPDATED value="${now()}" />
    </DATES>
    <BODY>
      <TEXT>${escapeXml(q.prompt)}</TEXT>
      <FLAGS value="true">
        <ISHTML value="true" />
      </FLAGS>
    </BODY>
${answersXml}
    <GRADABLE>
      <FEEDBACK_WHEN_CORRECT>Correct.</FEEDBACK_WHEN_CORRECT>
      <FEEDBACK_WHEN_INCORRECT>Incorrect.</FEEDBACK_WHEN_INCORRECT>
      <CORRECTANSWER answer_id="q${q.index}_a${q.correct_index + 1}" />
    </GRADABLE>
  </QUESTION_MULTIPLECHOICE>`;
    }).join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<POOL>
  <COURSEID value="IMPORT" />
  <TITLE value="${escapeXml(task.name)}" />
  <DESCRIPTION>
    <TEXT>${escapeXml(task.description || "")}</TEXT>
  </DESCRIPTION>
  <DATES>
    <CREATED value="${now()}" />
    <UPDATED value="${now()}" />
  </DATES>
  <QUESTIONLIST>
${questionList}
  </QUESTIONLIST>
${questionsXml}
</POOL>`;
}

function createManifestXML(filename) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man00001">
  <organization default="toc00001">
    <tableofcontents identifier="toc00001"/>
  </organization>
  <resources>
    <resource identifier="res00001"
              type="assessment/x-bb-pool"
              file="${filename}" />
  </resources>
</manifest>`;
}

async function createZIP(xml, manifest, taskName) {
    ensureExportsDir();

    const zipName = `blackboard_${taskName.replace(/\s+/g, "_")}.zip`;
    const zipPath = path.join(__dirname, "exports", zipName);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", reject);
        output.on("close", () => resolve(zipPath));

        archive.pipe(output);
        archive.append(xml, { name: "blackboard_quiz.dat" });
        archive.append(manifest, { name: "imsmanifest.xml" });
        archive.finalize();
    });
}

export async function convertToBlackboard(taskUid) {
    const task = await loadTask(taskUid);

    const xml = createBlackboardXML(task);
    const manifest = createManifestXML("blackboard_quiz.dat");

    const zipPath = await createZIP(xml, manifest, task.name);
    return zipPath;
}


if (process.argv.length === 3) {
    convertToBlackboard(Number(process.argv[2]))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
} else {
    console.log("Usage:");
    console.log("  node convert_to_blackboard_enhanced.js <taskUid>");
}