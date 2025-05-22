import * as d3Scale from 'd3-scale';
import * as d3Color from 'd3-scale-chromatic';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Rect, Svg, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;
const chartPadding = 20;
const chartWidth = screenWidth - chartPadding * 2;

interface HeatmapChartProps {
  data: number[][];
  title?: string;

  minValue?: number;
  maxValue?: number;
  xAxisLabels?: string[]
  yAxisLabels?: string[]
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, title, minValue, maxValue, xAxisLabels, yAxisLabels }) => {
  if (!data || data.length === 0 || data[0].length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>Waiting for heatmap data...</Text>
      </View>
    );
  }

  const numRows = data.length;
  const numCols = data[0].length;


  const cellSize = Math.min(chartWidth / numCols, 40);
  const chartHeight = numRows * cellSize + chartPadding;

  const xAxisLabelHeight = xAxisLabels ? 25 : 0;
  const yAxisLabelWidth = yAxisLabels ? 30 : 0;
  const finalChartHeight = chartHeight + xAxisLabelHeight;
  const finalChartWidth = chartWidth + yAxisLabelWidth;

  const allValues = data.flat();
  const minVal = minValue !== undefined ? minValue : Math.min(...allValues);
  const maxVal = maxValue !== undefined ? maxValue : Math.max(...allValues);


  const colorScale = d3Scale.scaleSequential(d3Color.interpolatePlasma)
    .domain([minVal, maxVal]);

  return (
    <View style={styles.chartWrapper}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <Svg height={finalChartHeight} width={finalChartWidth}>
        {data.map((row, rowIndex) => (
          <React.Fragment key={`row-${rowIndex}`}>
            {row.map((value, colIndex) => (
              <Rect
                key={`cell-${rowIndex}-${colIndex}`}
                x={colIndex * cellSize + chartPadding / 2 + yAxisLabelWidth}
                y={rowIndex * cellSize + chartPadding / 2 + xAxisLabelHeight}
                width={cellSize}
                height={cellSize}
                fill={colorScale(value)}
                stroke="#ccc"
                strokeWidth="0.5"
              />
            ))}
          </React.Fragment>
        ))}

        {data.map((row, rowIndex) => (
          <React.Fragment key={`text-row-${rowIndex}`}>
            {row.map((value, colIndex) => (
              <SvgText
                key={`text-cell-${rowIndex}-${colIndex}`}
                x={colIndex * cellSize + cellSize / 2 + chartPadding / 2 + yAxisLabelWidth}
                y={rowIndex * cellSize + cellSize / 2 + chartPadding / 2 + 5 + xAxisLabelHeight}
                fontSize="10"
                fill={colorScale(value) > '#888' ? 'black' : 'white'}
                textAnchor="middle"
              >
                {value.toFixed(1)}
              </SvgText>
            ))}
          </React.Fragment>
        ))}


        {xAxisLabels && (
          xAxisLabels.map((label, index) => (
            <SvgText
              key={`x-label-${index}`}
              x={index * cellSize + cellSize / 2 + chartPadding / 2 + yAxisLabelWidth}
              y={chartPadding / 2 + 15}
              fontSize="12"
              fill="#333"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ))
        )}

        {yAxisLabels && (
          yAxisLabels.map((label, index) => (
            <SvgText
              key={`y-label-${index}`}
              x={chartPadding / 2 + 10}
              y={index * cellSize + cellSize / 2 + chartPadding / 2 + 5 + xAxisLabelHeight}
              fontSize="12"
              fill="#333"
              textAnchor="end"
            >
              {label}
            </SvgText>
          ))
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  chartWrapper: {
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    paddingVertical: chartPadding / 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginVertical: 8,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
});

export { HeatmapChart };

