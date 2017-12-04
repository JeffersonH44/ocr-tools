'use strict';

var IJS = require('image-js').Image;
var fs = require('fs');
var tableify = require('tableify');

var {
    readPath,
    saveHTMLFile,
    saveMask,
    saveMRZ
} = require('../src/paths');
var {
    isMRZCorrect,
    getMRZ,
    filterManager,
    codes
} = require('../src/MRZDetection');

// options
const maskOptions = {
    invert: true,
    algorithm: 'isodata'
};

var files = fs.readdirSync(readPath);
var promises = files.map(elem => IJS.load(readPath + elem));
var table = [];

Promise.all(promises).then(function (images) {
    var counters = new Array(Object.keys(codes).length).fill(0);

    for (var i = 0; i < images.length; i++) {
        console.log('processing:', files[i]);
        var image = images[i];
        var grey = image.grey({allowGrey: true});
        var mask = grey.mask(maskOptions);

        if (!fs.existsSync(saveMask)) {
            fs.mkdirSync(saveMask);
        }

        var maskPath = saveMask + files[i].replace('.png', '.bmp');
        mask.save(maskPath, {
            useCanvas: false,
            format: 'bmp'
        });
        var manager = image.getRoiManager();
        manager.fromMask(mask);

        var {
            parseRowInfo,
            rowsInfo,
            rois
        } = filterManager(manager);

        try {
            var {
                y,
                height,
                filteredHistogram,
                simPeaks,
                simBetweenPeaks
            } = getMRZ(parseRowInfo, rowsInfo, rois, image.width);
        } catch (e) {
            console.log('not able to find mrz for', files[i]);
            continue;
        }

        var margin = 0;

        var crop = image.crop({
            y: y - margin,
            height: height + 2 * margin
        });

        if (!fs.existsSync(saveMRZ)) {
            fs.mkdirSync(saveMRZ);
        }
        var cropPath = saveMRZ + files[i];
        crop.save(cropPath, {
            useCanvas: false,
            format: 'png'
        });

        // get letter mrz
        var {
            code,
            outputTable
        } = isMRZCorrect(crop, files[i]);
        counters[code]++;

        if(code === codes.PREPROCESS_ERROR.code) {
            console.log('preprocess error');
            continue;
        }

        if (code === codes.CORRECT.code) {
            console.log(`file: ${files[i]} is correct!`);
        }

        table.push({
            image: [
                `<img src="./${maskPath}" width="600" height="600">`,
                `<img src="./${cropPath}" width="600" height="200">`,
            ].concat(outputTable.images),
            'Row info median': `<span class='histogram'>${parseRowInfo.join(',')}</span>`,
            'Filtered info median': `<span class='histogram'>${filteredHistogram.join(',')}</span>`,
            simPeaks: simPeaks,
            simBetweenPeaks: simBetweenPeaks,
            'Error information': outputTable['Error Information'],
            'Code error': outputTable['Code Error'],
            'Histogram': outputTable.Histogram
            // 'Col info median': `<span class='histogram'>${colsInfo.join(',')}</span>`
        });
    }

    fs.writeFileSync(saveHTMLFile,
        `
        <!DOCTYPE html>
        <html>
        <head>
        <style>
            html *
            {
                font-family: "Courier New", Courier, monospace;
            }
        </style>
        </head>
        <body>
        ${tableify(table)}
        </body>
        <script src="https://code.jquery.com/jquery-3.2.1.js"
        integrity="sha256-DZAnKJ/6XZ9si04Hgrsxu/8s717jcIzLy3oi35EouyE="
        crossorigin="anonymous"></script>
        <script src="https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.js"></script>
        <script type="text/javascript">
        $(function() {
            /** This code runs when everything has been loaded on the page */
            /* Inline sparklines take their values from the contents of the tag */
            $('.histogram').sparkline('html', {
                type: 'line',
                width: 400,
                height: 100
            }); 
        });
        </script>
        </html>
        `
    );
});
