import React, { useState, useEffect, useId } from 'react';
import './LineChartComponent.css';
import { useLanguage } from '../../context/LanguageContext';

function LineChartComponent({ 
    data = [], 
    color = "var(--black-color)",
    gradientColor, // Optional: if you want the gradient to be a different color than the line
    lineThickness = 2, // Controls the stroke width of the line
    pointRadius, // Optional: custom radius for the point
    hoverPointRadius, // Optional: custom radius for the point when hovered
    width = "100%", 
    height = "250px", 
    unit = "RON" 
}) {
    const { formatMoney } = useLanguage();
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [isAnimated, setIsAnimated] = useState(false);
    
    // Generate a unique ID for this instance to prevent SVG gradient conflicts 
    // when rendering multiple charts on the same page.
    const chartId = useId(); 
    const gradientId = `lineGradient-${chartId.replace(/:/g, "")}`;

    // Smart fallbacks: if specific props aren't provided, scale them based on line thickness
    const actualGradientColor = gradientColor || color;
    const actualPointRadius = pointRadius || (lineThickness + 2);
    const actualHoverPointRadius = hoverPointRadius || (actualPointRadius + 3);

    // 1. Initial animation trigger & data readiness optimization
    useEffect(() => {
        // If there is no data or not enough data points, reset animation and wait
        if (!data || !Array.isArray(data) || data.length < 2) {
            setIsAnimated(false);
            return;
        }

        // Once data is available, trigger the animation after a short delay
        const timeout = setTimeout(() => setIsAnimated(true), 50);
        
        return () => clearTimeout(timeout);
    }, [data]);

    // 2. Guard clause: Line charts need at least 2 points to draw a path
    if (!data || !Array.isArray(data) || data.length < 2) {
        return <p>Not enough data for a chart.</p>;
    }

    // 3. SVG Internal Coordinates
    const svgWidth = 800;
    const svgHeight = 250;
    const paddingX = 40; 
    const paddingY = 40; 

    const drawWidth = svgWidth - paddingX * 2;
    const drawHeight = svgHeight - paddingY * 2;
    const maxValue = Math.max(...data.map(d => Number(d.value) || 0)) || 1; 

    const points = data.map((item, index) => {
        const x = paddingX + (index / (data.length - 1)) * drawWidth;
        const numericValue = Number(item.value) || 0;
        const y = (svgHeight - paddingY) - (numericValue / maxValue) * drawHeight;
        return { ...item, x, y, numericValue };
    });

    const linePath = "M " + points.map(p => `${p.x},${p.y}`).join(" L ");
    const fillPath = `${linePath} L ${points[points.length - 1].x},${svgHeight - paddingY} L ${points[0].x},${svgHeight - paddingY} Z`;

    return (
        <div 
            className="line-chart-container" 
            style={{ width: width, height: height }} // Outer control
        >
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="line-chart-svg">
                <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={actualGradientColor} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={actualGradientColor} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Render the paths only when isAnimated is true to trigger CSS @keyframes on mount */}
                {isAnimated && (
                    <>
                        <path 
                            d={fillPath} 
                            fill={`url(#${gradientId})`} 
                            className="line-fill-anim" 
                        />

                        <path 
                            d={linePath} 
                            fill="none" 
                            stroke={color} 
                            strokeWidth={lineThickness} // Applied dynamic line thickness
                            strokeLinecap="round" // Makes line ends smoother
                            strokeLinejoin="round" // Makes line corners smoother
                            className="line-stroke-anim" 
                        />
                    </>
                )}

                {points.map((p, i) => {
                    const isHovered = hoveredPoint === i;
                    const displayValue = formatMoney(p.numericValue);

                    return (
                        <g 
                            key={i} 
                            className="point-group" 
                            onMouseEnter={() => setHoveredPoint(i)} 
                            onMouseLeave={() => setHoveredPoint(null)}
                            // Smooth fade-in for the points to match the line drawing
                            style={{ 
                                opacity: isAnimated ? 1 : 0, 
                                transition: 'opacity 0.6s ease-in 0.3s' 
                            }} 
                        >
                            {isHovered && (
                                <line 
                                    x1={p.x} y1={paddingY} 
                                    x2={p.x} y2={svgHeight - paddingY} 
                                    strokeWidth={1}
                                    strokeDasharray="4 4" // Gives a dotted line effect for the hover guide
                                    className="hover-guideline"
                                />
                            )}
                            
                            <circle 
                                cx={p.x} cy={p.y} 
                                r={isHovered ? actualHoverPointRadius : actualPointRadius} // Applied dynamic radii
                                fill={color} 
                                className="line-point"
                            />

                            <text 
                                x={p.x} 
                                y={svgHeight - 10} 
                                className="line-label"
                            >
                                {p.label || ""}
                            </text>

                            {isHovered && (
                                <g className="line-tooltip">
                                    <rect 
                                        x={p.x - 50} 
                                        y={p.y - 45} 
                                        width="100" 
                                        height="28" 
                                        rx="6" 
                                        className="tooltip-bg" 
                                    />
                                    <text 
                                        x={p.x} 
                                        y={p.y - 25} 
                                        className="tooltip-text"
                                    >
                                        {displayValue} {unit}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export default LineChartComponent;