declare var require: any;
const fs = require('fs');

const lines = fs.readFileSync("COVERAGE.md", "utf8").split('\n').filter(l => /^\s*\- \[|^### /.test(l));

let linesCounter = 0;
let stats = processLines(0);
printStats("Total", stats);

function printStats(title, stats) {
    console.log(title, Math.round(stats.total * 100) + "%");
    if (!stats.hasNested)
        return;
    for (let k in stats) {
        if (k != "total" && k != "hasNested")
            printStats(k, stats[k]);
    }
}

function processLines(indent: number): { [key: string]: any } {
    let implemented = 0;
    let total = 0;
    let stats = {};
    while (linesCounter < lines.length) {
        const spaces = lines[linesCounter].match(/^\s*/)[0];
        if (spaces.length < indent)
            break;

        total += 1;
        if (lines[linesCounter + 1] && lines[linesCounter + 1].startsWith(spaces + " ")) {
            const title = lines[linesCounter];
            linesCounter++;
            const lineStats = processLines(spaces.length + 1);
            implemented += lineStats.total;
            stats[title] = lineStats;
            stats["hasNested"] = true;
        } else if (lines[linesCounter].startsWith(spaces + "- [x]")) {
            const progress = lines[linesCounter].endsWith(")_") ? 0.5 : 1;
            stats[lines[linesCounter]] = { total: progress };
            implemented += progress;
            linesCounter++;
        } else {
            stats[lines[linesCounter]] = { total: 0 };
            linesCounter++;
        }
    }
    stats["total"] = implemented / total;
    return stats;
}