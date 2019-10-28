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
        let e = wre.create_entity();
        wre.add_mesh(e, this._objText);
        let script = new WreScript();
        // script.transform.position = glm.add(imagePlaneLocation, glm.mul(this._camDir, 0.1));
        script.transform.position = coord;
        script.transform.scale = glm.vec3(0.05, 0.05, 0.05);
        wre.add_script(e, script);
        wre.set_color(e, [0, 1, 0, 1]);
    }

    start() {
        loadResource('/resources/models/sphere_smooth.obj').then((objText) => {
            this._objText = objText;
        });
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

        let colors = {
            "red": [0.584314, 0.109804, 0.0745098, 1.0],
            "orange": [0.666667, 0.278431, 0.0235294, 1.0],
            "yellow": [0.627451, 0.588235, 0.0117647, 1.0],
            "lightGreen": [0.239216, 0.435294, 0.00392157, 1.0],
            "darkGreen": [0.0313726, 0.243137, 0.0156863, 1.0],
            "lightBlue": [0.509804, 0.611765, 0.709804, 1.0],
            "darkBlue": [0.121569, 0.345098, 0.596078, 1.0],
            "lightPurple": [0.45098, 0.380392, 0.560784, 1.0],
            "darkPurple": [0.2, 0.0823529, 0.317647, 1.0],
        }
        let board = {
            "red": [[1, 6], [5, 1], [7, 8], [8, 3]],
            "orange": [[0, 4], [2, 2], [3, 1], [6, 6]],
            "yellow": [[0, 6], [1, 0], [2, 3], [3, 2], [5, 8], [8, 4]],
            "lightGreen": [[2, 6], [3, 7], [6, 5]],
            "darkGreen": [[2, 1], [6, 2], [8, 7]],
            "lightBlue": [[2, 0], [5, 5], [8, 2]],
            "darkBlue": [[0, 1], [3, 3], [5, 7], [7, 2]],
            "lightPurple": [[0, 3], [3, 6], [5, 2], [6, 7], [8, 5]],
            "darkPurple": [[0, 5], [3, 0], [5, 6], [6, 8]],
        };
        return;
        loadResource('/resources/models/small_sphere.obj').then((objText) => {
            this._objText = objText;
            for (let color in board) {
                for (let pairIndex in board[color]) {
                    let sphere = wre.create_entity();
                    wre.add_mesh(sphere, objText);
                    let script = new WreScript();
                    script.transform.position = glm.add(
                        glm.mul(glm.vec3(0.0, 0.0, 0.1), board[color][pairIndex][0]),
                        glm.mul(glm.vec3(0.1, 0.0, 0.0), board[color][pairIndex][1])
                    );
                    script.transform.position = glm.sub(
                        script.transform.position,
                        glm.vec3(0.4, 0.0, 0.4),
                    );
                    wre.add_script(sphere, script);
                    wre.set_color(sphere, colors[color]);
                }
            }
        })
    }

    update() {
    }
}
