var Papa = require('papaparse');
var fs = require('fs');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz<'.toUpperCase();
const LINE_LENGTH = 'line length';

class LettersStatistics {
    constructor(filepath) {
        var file = fs.readFileSync(filepath, 'utf-8');
        var data = Papa.parse(file).data;
        this.data = {};
        for (var i = 0; i < data.length; ++i) {
            var currentMRZ = data[i].slice(1);
            var name = data[i][0];

            if(currentMRZ.length < 2) {
                throw new Error(`MRZ for ${name} should have at least 2 lines`);
            }

            var size = currentMRZ[0].length;
            for (var j = 1; j < currentMRZ.length; ++j) {
                if(size !== currentMRZ[j].length) {
                    throw new Error(`MRZ for ${name} should have the same length for all the lines`);
                }
            }
            this.data[name] = currentMRZ;
        }

        this.letters = {};
        for(i = 0; i < ALPHABET.length; ++i) {
            var letter = ALPHABET[i];
            this.letters[letter] = {
                count: 0,
                errors: new Set([])
            };
        }
        this.letters[LINE_LENGTH] = {
            count: 0
        };
    }

    check(filename, mrz) {
        var data = this.data[filename];

        if(data.length !== mrz.length) {
            throw new Error(`Number of lines in the detected MRZ is not the same as the ground truth for ${filename}`);
        }

        for(var i = 0; i < mrz.length; ++i) {
            var line = mrz[i];
            var ground = data[i];

            if(line.length !== ground.length); {
                this.letters[LINE_LENGTH].count++;
                continue;
            }

            for(var j = 0; j < line.length; ++j) {
                var predictedLetter = line[j];
                var groundLetter = ground[j];
                if (predictedLetter !== groundLetter) {
                    this.letters[groundLetter].count++;
                    this.letters[groundLetter].errors.add(predictedLetter);
                }
            }
        }
    }

    getResults() {
        return this.letters;
    }
}

module.exports = LettersStatistics;

// var data = new LettersStatistics('./../data/passport/ground.csv');