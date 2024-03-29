/* BoardManager.js
 *
 * Copyright (c) 2019, University of Minnesota
 *
 * Author: Bridger Herman
 *
 * Creates a board from a list of locations, then manages clicks on the board
 */

import * as wre from '../pkg/wre_wasm.js';
import { WreScript, loadResource } from '../wre.js';
import { Ray } from '../ray.js';
import { PlaceToken } from './placeToken.js';
import { Transform } from '../transform.js';
import { oneFromWin, nearlySolved, easy, challenging } from './boards.js'

export class BoardManager extends WreScript {
    // Arrow function to preserve `this` context
    mouseHandler = (evt) => {
        let xOffset = glm.mul(this._camRight, this._pixelWidth * evt.offsetX);
        let yOffset = glm.mul(this._camUp, -this._pixelHeight * evt.offsetY);

        let upLeftPlusYOffset = glm.add(
            this._upperLeft,
            yOffset,
        );
        let imagePlaneLocation = glm.add(
            upLeftPlusYOffset,
            xOffset,
        );
        let rayDir = glm.normalize(glm.sub(imagePlaneLocation, this._camPos));

        let mouseRay = new Ray(this._camPos, rayDir);

        let t = 0.0;
        let deltaT = 0.01;
        let underSurface = false;
        let coord = glm.vec3(0);
        while (t < 10.0 && !underSurface) {
            coord = mouseRay.eval(t);
            if (coord.y <= 0.0) {
                underSurface = true;
            }
            t += deltaT;
        }

        // Gives int in range [-4, 4]
        let coordX2D = Math.round(coord.x * 10.0);
        let coordY2D = Math.round(coord.z * 10.0);

        // Gives int in range [0, 8]
        let boardCoords = [coordY2D + 4, coordX2D + 4];

        let checkBounds = (c) => {return c >= 0 && c < 9};

        if (checkBounds(boardCoords[0]) && checkBounds(boardCoords[1])) {
            let valid = this.checkSpace(...boardCoords, this._currentColor);

            let e = wre.create_entity();
            wre.add_mesh(e, this._objText);
            let script = new PlaceToken();

            let startTransform = Transform.identity();
            startTransform.position = glm.vec3(0.0, 0.5, -0.5);
            startTransform.scale = glm.vec3(1.0, 1.0, 8.0);

            let midTransform = Transform.identity();
            midTransform.position = glm.vec3(coordX2D * 0.1, 0.0, coordY2D * 0.1); 
            midTransform.scale = glm.vec3(1.0, 2.0, 1.0);

            let endTransform = Transform.identity();
            endTransform.position = glm.vec3(coordX2D * 0.1, 0.0, coordY2D * 0.1); 
            endTransform.scale = glm.vec3(1.0, 1.0, 1.0);

            wre.set_color(e, this._colors[this._currentColor]);
            if (valid) {
                script.setKeyframe(startTransform, 0.0);
                script.setKeyframe(midTransform, 0.5);
                script.setKeyframe(endTransform, 1.0);

                wre.add_script(e, script);
                this._board[this._currentColor].push(boardCoords);

                let win = Object.values(this._board).every((v) => v.length == 9);
                if (win) {
                    document.getElementById('win-container').innerHTML = '<h1 id="win-text">WINNER!</h1>';
                }
            } else {
                let lastTf = Transform.identity();
                lastTf.position = glm.vec3(0.0, 1.0, 0.0);
                lastTf.scale = glm.vec3(1.0, 6.0, 1.0);

                script.setKeyframe(startTransform, 0.0);
                script.setKeyframe(midTransform, 0.2);
                midTransform.position = glm.add(midTransform.position, glm.vec3(0, 0.1, 0));
                script.setKeyframe(endTransform, 0.5);
                endTransform.position = glm.add(midTransform.position, glm.vec3(0, 0.1, 0));
                script.setKeyframe(lastTf, 1.0);

                wre.add_script(e, script);
                wre.set_color(e, this._colors[this._currentColor]);
            }
        }
    }

    checkSpace(row, col, testColor) {
        // Check to see if anything's already in the space
        for (let color in this._board) {
            for (let i in this._board[color]) {
                let space = this._board[color][i];
                if (row == space[0] && col == space[1]) {
                    return false;
                }
            }
        }

        // Check to see if anything of this color is already in the column or
        // row
        for (let i in this._board[testColor]) {
            let space = this._board[testColor][i];
            if (row == space[0] || col == space[1]) {
                return false;
            }
        }

        // Check to see if anything of this color is already in the same box
        let rowBox = Math.floor(row / 3);
        let colBox = Math.floor(col / 3);
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                let inBox = this._board[testColor].find((el) => {
                    return el[0] == ((rowBox * 3) + r) && el[1] == ((colBox * 3) + c);
                });

                if (inBox) {
                    return false;
                }
            }
        }
        return true;
    }

    start() {
        let canvas = document.getElementById('canvas');
        canvas.addEventListener('click', (evt) => this.mouseHandler(evt));

        this._nearPlane = 0.1;
        this._aspect = 16.0 / 9.0;
        this._vertHalfAngle = glm.radians(45.0 / 2.0);
        this._viewportHeight = 2.0 * Math.tan(this._vertHalfAngle);
        this._viewportWidth = this._viewportHeight * this._aspect;
        this._pixelWidth = this._viewportWidth / canvas.width;
        this._pixelHeight = this._viewportHeight / canvas.height;

        // TODO: Not sure why this is necessary.... pixel sizes are way too
        // big
        this._pixelWidth *= 0.1;
        this._pixelHeight *= 0.1;

        this._camPos = glm.vec3(0, 1, 1);
        this._camDir = glm.normalize(glm.vec3(0, -1, -1));
        this._camUp = glm.normalize(glm.vec3(0, 1, -1));
        this._camRight = glm.vec3(1, 0, 0);

        // The upper-left-most pixel
        // 0.5s are to center the rays on each pixel
        let imagePlaneCenterOffset = glm.mul(this._camDir, this._nearPlane);
        let imagePlaneCenter = glm.add(this._camPos, imagePlaneCenterOffset);
        let topRow = glm.mul(
            this._camUp,
            this._pixelHeight * (canvas.height / 2.0 - 0.5)
        );
        let leftRow = glm.mul(
            this._camRight,
            -this._pixelWidth * (canvas.width / 2.0 - 0.5)
        );
        let topLeft = glm.add(
            topRow,
            leftRow,
        );

        this._upperLeft = glm.add(topLeft, imagePlaneCenter);

        this._colors = {
            "red": [0.584314, 0.109804, 0.0745098, 1.0],
            "orange": [0.666667, 0.278431, 0.0235294, 1.0],
            "yellow": [0.627451, 0.588235, 0.0117647, 1.0],
            "lightGreen": [0.239216, 0.435294, 0.00392157, 1.0],
            "darkGreen": [0.0313726, 0.243137, 0.0156863, 1.0],
            "lightBlue": [0.509804, 0.611765, 0.709804, 1.0],
            "darkBlue": [0.121569, 0.345098, 0.596078, 1.0],
            "lightPurple": [0.45098, 0.380392, 0.560784, 1.0],
            "darkPurple": [0.2, 0.0823529, 0.317647, 1.0],
        };

        for (let colorName in this._colors) {
            let colorInts = this._colors[colorName].map((c) => parseInt(c * 255));
            let colorValue = "#" + ((1 << 24) + (colorInts[0] << 16) + (colorInts[1] << 8) + colorInts[2]).toString(16).slice(1);
            let buttonHtml = `<button id="${colorName}" class="color-button"><div class="color-preview" style="background-color: ${colorValue}"></div></button>`;
            document.getElementById('button-container').innerHTML += buttonHtml;
        }

        this._currentColor = Object.keys(this._colors)[0];
        document.getElementById(this._currentColor).style['background-color'] = '#DDD';

        for (let colorName in this._colors) {
            let button = document.getElementById(colorName);
            button.addEventListener('click', (evt) => {
                let clicked = evt.target;
                if (!this._colors.hasOwnProperty(evt.target.id)) {
                    clicked = clicked.parentElement;
                }

                let buttons = document.getElementsByClassName('color-button');
                for (let i = 0; i < buttons.length; i++) {
                    buttons[i].style['background-color'] = '#000';
                }

                this._currentColor = clicked.id;
                clicked.style['background-color'] = '#DDD';
            });
        }

        this._board = easy;

        loadResource('./resources/models/small_sphere.obj').then((objText) => {
            this._objText = objText;
        });

        loadResource('./resources/models/small_sphere.obj').then((objText) => {
            for (let color in this._board) {
                for (let pairIndex in this._board[color]) {
                    let sphere = wre.create_entity();
                    wre.add_mesh(sphere, objText);
                    let script = new WreScript();
                    script.transform.position = glm.add(
                        glm.mul(glm.vec3(0.0, 0.0, 0.1), this._board[color][pairIndex][0]),
                        glm.mul(glm.vec3(0.1, 0.0, 0.0), this._board[color][pairIndex][1])
                    );
                    script.transform.position = glm.sub(
                        script.transform.position,
                        glm.vec3(0.4, 0.0, 0.4),
                    );
                    wre.add_script(sphere, script);
                    wre.set_color(sphere, this._colors[color]);
                }
            }
        })
    }

    update() {
    }
}

