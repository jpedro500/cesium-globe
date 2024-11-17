import React, { useEffect, useRef } from 'react';

import { 
    Viewer,
    ShadowMode,
    JulianDate,
    Cartesian3,
    Math,
    Color,
    Transforms,
    Matrix3,
    Matrix4,
    SceneMode,
    ReferenceFrame,
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
            const meanMotion = satrec.no * (1440 / (2 * Math.PI)); // Orbits per day
            const orbitalPeriod = 86400 / meanMotion; // Seconds per orbit
            const step = 1;
  

            // Add satellite entity
            const satelliteEntity = viewer.entities.add({
                name: 'ISS (ZARYA)',
                position: Cartesian3.fromDegrees(0, 0, 0), // Temporary initial position
                point: {
                    pixelSize: 10,
                    color: Color.RED,
                },
                label: {
                    text: 'ISS',
                    font: '12pt sans-serif',
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                },
            });
              
            // Add orbit entity
            const orbitEntity = viewer.entities.add({
                name: 'Satellite Orbit',
                polyline: {
                    positions: [],
                    width: 2,
                    material: Color.YELLOW,
                },
            });
        
            // Precomputed orbit positions
            let precomputedOrbitPositions: Cartesian3[] = [];
            let nextRecomputeTime = JulianDate.clone(viewer.clock.currentTime);

            // Function to propagate satellite and compute orbit
            const propagateOrbit = () => {
                const orbitPositions: Cartesian3[] = [];
                const startTime = JulianDate.clone(viewer.clock.currentTime);
                const stopTime = JulianDate.addSeconds(startTime, orbitalPeriod, new JulianDate());

                for (
                    let time = JulianDate.clone(startTime);
                    JulianDate.lessThan(time, stopTime);
                    JulianDate.addSeconds(time, step, time)
                ) {
                    const jdTime = JulianDate.toDate(time);
                    const orbitPositionAndVelocity = propagate(satrec, jdTime);

                    const orbitPositionEci = orbitPositionAndVelocity.position;
                    
                    // Directly use ECI coordinates (convert km to meters)
                    const eciPosition = new Cartesian3(
                        orbitPositionEci.x * 1000,
                        orbitPositionEci.y * 1000,
                        orbitPositionEci.z * 1000
                    );

                    orbitPositions.push(eciPosition);
                    
                }

                precomputedOrbitPositions = orbitPositions; // Save the positions
                nextRecomputeTime = JulianDate.addSeconds(startTime, orbitalPeriod, new JulianDate()); // Set next recompute time

                // Update orbit polyline
                orbitEntity.polyline.positions = orbitPositions;
            };

            // Function to update satellite position from precomputed data
            const updateSatellitePosition = () => {
                const currentTime = JulianDate.clone(viewer.clock.currentTime);

                // Check if it's time to recompute the orbit
                if (JulianDate.greaterThan(currentTime, nextRecomputeTime)) {
                    propagateOrbit();
                }

            // Calculate the elapsed time since the last recompute
            const elapsedSeconds = JulianDate.secondsDifference(currentTime, nextRecomputeTime) + orbitalPeriod;

            // Calculate the index in the precomputed positions
            const index = window.Math.round((elapsedSeconds % orbitalPeriod) / step);

            // Ensure the index is within bounds
            if (index >= 0 && index < precomputedOrbitPositions.length) {
                satelliteEntity.position = precomputedOrbitPositions[index];
            }
            };

            // Initial propagation
            propagateOrbit();

            // Update satellite and orbit on each clock tick
            viewer.clock.onTick.addEventListener(updateSatellitePosition);

            return () => {
                viewer.destroy();
            };
        }
    }, []);

    return <div ref={viewerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default CesiumGlobe;
