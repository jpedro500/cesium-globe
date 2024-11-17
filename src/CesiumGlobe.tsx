import React, { useEffect, useRef } from 'react';

import { 
    Viewer,
    ShadowMode,
    JulianDate,
    Cartesian3,
    Math,
    Color
} from 'cesium';

import { 
    twoline2satrec, 
    propagate,
    eciToGeodetic,
    gstime
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
                const orbitTime = JulianDate.toDate(time);
                const orbitGmst = gstime(orbitTime);
                const orbitPositionAndVelocity = propagate(satrec, orbitTime);

                const orbitPositionEci = orbitPositionAndVelocity.position;
                const orbitPositionGd = eciToGeodetic(orbitPositionEci, orbitGmst);

                const orbitLongitude = Math.toDegrees(orbitPositionGd.longitude);
                const orbitLatitude = Math.toDegrees(orbitPositionGd.latitude);
                const orbitHeight = orbitPositionGd.height * 1000;

                orbitPositions.push(Cartesian3.fromDegrees(orbitLongitude, orbitLatitude, orbitHeight));
    
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
