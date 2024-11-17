import React, { useEffect, useRef } from 'react';

import { 
    Viewer,
    ShadowMode,
    JulianDate,
    Cartesian3,
    Math,
    Color,
    Transforms,
    Matrix4,
    SceneMode,
    CzmlDataSource
} from 'cesium';

import { 
    twoline2satrec, 
    propagate,
} from 'satellite.js';



const CesiumGlobe: React.FC = () => {
    const viewerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (viewerRef.current) {
            const viewer = new Viewer(viewerRef.current, {
                animation: true,
                timeline: true,
                baseLayerPicker: false,
                fullscreenButton: false,
                infoBox: false,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                scene3DOnly: true,
                shouldAnimate: true,
                shadows: true
            });
            ///////////////////////////////////////////////////////
            // Enable globe shadows
            viewer.scene.globe.shadows = ShadowMode.ENABLED;

            // Ensure the sun light source is used
            viewer.scene.globe.enableLighting = true;
            // Move camera to a fixed referencial, in order to not rotate togehter with earth rotation

            function move_to_fixed() {
                if (viewer.scene.mode !== SceneMode.SCENE3D) {
                  return;
                }
              
                const icrfToFixed = Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime);
                const camera = viewer.camera;
                const offset = Cartesian3.clone(camera.position);
                const transform = Matrix4.fromRotationTranslation(icrfToFixed);
                camera.lookAtTransform(transform, offset);  
              }


            viewer.scene.postUpdate.addEventListener(move_to_fixed);
            ///////////////////////////////////////////////////////

            ///////////////////////////////////////////////////////            
            // TLE data for the satellite
            const tleLine1 ='1 25544U 98067A   24322.09401066  .00019103  00000-0  34302-3 0  9998';
            const tleLine2 ='2 25544  51.6410 277.8367 0007583 226.0535 235.5529 15.49882713482266';

            // Convert TLE to satellite record
            const satrec = twoline2satrec(tleLine1, tleLine2);
            ///////////////////////////////////////////////////////
            // Generate CZML Data
            const czml = generateCzmlForOrbit(satrec, viewer);

            // Load CZML into the viewer
            const czmlDataSource = new CzmlDataSource();
            czmlDataSource.load(czml);
            viewer.dataSources.add(czmlDataSource);

            ///////////////////////////////////////////////////////
        


            return () => {
                viewer.destroy();
            };
        }
    }, []);

 ///////////////////////////////////////////////////////
    // Function to generate CZML for the orbit
    const generateCzmlForOrbit = (satrec: any, viewer: Viewer) => {
        const startTime = JulianDate.now();
        const orbitalPeriod = 86400 / (satrec.no * (1440 / (2 * Math.PI))); // Orbital period in seconds
        const stopTime = JulianDate.addSeconds(startTime, orbitalPeriod, new JulianDate());
        const step = 60; // Sample every 60 seconds

        const czml: any[] = [
            {
                id: 'document',
                name: 'Satellite Orbit',
                version: '1.0',
                clock: {
                    interval: `${JulianDate.toIso8601(startTime)}/${JulianDate.toIso8601(stopTime)}`,
                    currentTime: JulianDate.toIso8601(startTime),
                    multiplier: 60, // Faster time progression
                    range: 'LOOP_STOP',
                },
            },
            {
                id: 'satellite',
                name: 'ISS (ZARYA)',
                availability: `${JulianDate.toIso8601(startTime)}/${JulianDate.toIso8601(stopTime)}`,
                position: {
                    epoch: JulianDate.toIso8601(startTime),
                    referenceFrame: 'INERTIAL', // Use the inertial frame
                    cartesian: [], // Position samples will be added here
                },
                point: {
                    pixelSize: 10,
                    color: Color.RED.withAlpha(0.8),
                },
                path: {
                    material: { solidColor: { color: Color.YELLOW.withAlpha(0.8) } },
                    width: 2,
                    resolution: 120, // Smooth path
                },
            },
        ];

        // Generate position samples
        const positionData = [];
        for (
            let time = JulianDate.clone(startTime), seconds = 0;
            JulianDate.lessThan(time, stopTime);
            JulianDate.addSeconds(time, step, time), seconds += step
        ) {
            const currentDate = JulianDate.toDate(time);
            const positionAndVelocity = propagate(satrec, currentDate);

            if (positionAndVelocity && positionAndVelocity.position) {
                const { x, y, z } = positionAndVelocity.position; // ECI in km
                positionData.push(seconds, x * 1000, y * 1000, z * 1000); // Convert to meters
            }
        }

        // Add position samples to the CZML
        czml[1].position.cartesian = positionData;

        return czml;
    };

    return <div ref={viewerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default CesiumGlobe;
