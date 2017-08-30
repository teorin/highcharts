/* global Highcharts module:true */
(function (factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory;
	} else {
		factory(Highcharts);
	}
}(function (H) {
	'use strict';
	var UNDEFINED,
		each = H.each,
		merge = H.merge,
		isArray = H.isArray,
		SMA = H.seriesTypes.sma;

	// Utils:
	function getStandardDeviation(arr, mean) {
		var variance = 0,
			arrLen = arr.length,
			std = 0,
			i = 0;

		for (; i < arrLen; i++) {
			variance += (arr[i][3] - mean) * (arr[i][3] - mean);
		}
		variance = variance / (arrLen - 1);

		std = Math.sqrt(variance);
		return std;
	}

	H.seriesType('bb', 'sma', {
		name: 'BB (20, 2)',
		params: {
			period: 20,
			standardDeviation: 2
		},
		// Q: topLine.styles vs topLineStyles
		// Q: series.topLine vs series.params.topLine
		topLine: {
			styles: {
				lineWidth: 1
			}
		},
		bottomLine: {
			styles: {
				lineWidth: 1
			}
		},
		marker: {
			enabled: false
		},
		tooltip: {
			pointFormat: '<span style="color:{point.color}">\u25CF</span> <b> {series.name}</b><br/>' +
				'Top: {point.top}<br/>' +
				'Middle: {point.middle}<br/>' +
				'Bottom: {point.bottom}<br/>'
		},
		dataGrouping: {
			approximation: function (top, middle, bot) {
				var ret = [
					H.approximations.average(top),
					H.approximations.average(middle),
					H.approximations.average(bot)
				];
				if (ret[0] !== UNDEFINED && ret[1] !== UNDEFINED && ret[2] !== UNDEFINED) {
					return ret;
				}
				return UNDEFINED;
			}
		}
	}, {
		pointArrayMap: ['top', 'middle', 'bottom'],
		pointValKey: 'middle',
		init: function () {
			SMA.prototype.init.apply(this, arguments);

			// Set default color for lines:
			this.options = merge({
				topLine: {
					styles: {
						lineColor: this.color
					}
				},
				bottomLine: {
					styles: {
						lineColor: this.color
					}
				}
			}, this.options);
		},
		toYData: function (point) {
			return [point.top, point.middle, point.bottom];
		},
		translate: function () {
			var indicator = this,
				translatedBB = ['plotTop', 'plotMiddle', 'plotBottom'];

			SMA.prototype.translate.apply(indicator, arguments);

			each(indicator.points, function (point) {
				each([point.top, point.middle, point.bottom], function (value, i) {
					if (value !== null) {
						point[translatedBB[i]] = indicator.yAxis.toPixels(value, true);
					}
				});
			});
		},
		drawGraph: function () {
			var indicator = this,
				middleLinePoints = indicator.points,
				pointsLength = middleLinePoints.length,
				middleLineOptions = indicator.options,
				middleLinePath = indicator.graph,
				gappedExtend = {
					options: {
						gapSize: middleLineOptions.gapSize
					}
				},
				deviations = [[], []], // top and bottom point place holders
				point;

			// Generate points for top and bottom lines:
			while (pointsLength--) {
				point = middleLinePoints[pointsLength];
				deviations[0].push({
					plotX: point.plotX,
					plotY: point.plotTop,
					isNull: point.isNull
				});
				deviations[1].push({
					plotX: point.plotX,
					plotY: point.plotBottom,
					isNull: point.isNull
				});
			}

			// Modify options and generate lines:
			each(['topLine', 'bottomLine'], function (lineName, i) {
				indicator.points = deviations[i];
				indicator.options = merge(middleLineOptions[lineName].styles, gappedExtend);
				indicator.graph = indicator['graph' + lineName];
				SMA.prototype.drawGraph.call(indicator);

				// Now save lines:
				indicator['graph' + lineName] = indicator.graph;
			});

			// Restore options and draw a middle line:
			indicator.points = middleLinePoints;
			indicator.options = middleLineOptions;
			indicator.graph = middleLinePath;
			SMA.prototype.drawGraph.call(indicator);
		},
		getValues: function (series, params) {
			var period = params.period,
				standardDeviation = params.standardDeviation,
				xVal = series.xData,
				yVal = series.yData,
				yValLen = yVal ? yVal.length : 0,
				BB = [], // 0- date, 1-middle line, 2-top line, 3-bottom line
				ML, TL, BL, // middle line, top line and bottom line
				date,
				xData = [],
				yData = [],
				slicedX,
				slicedY,
				stdDev,
				point,
				i;

			// BB requires close value
			if (xVal.length <= period || !isArray(yVal[0]) || yVal[0].length !== 4) {
				return false;
			}

			for (i = period + 1; i <= yValLen; i++) {
				slicedX = xVal.slice(i - period - 1, i);
				slicedY = yVal.slice(i - period - 1, i);

				point = SMA.prototype.getValues.call(this, {
					xData: slicedX,
					yData: slicedY
				}, params);

				date = point.xData[0];
				ML = point.yData[0];
				stdDev = getStandardDeviation(slicedY, ML);
				TL = ML + standardDeviation * stdDev;
				BL = ML - standardDeviation * stdDev;
				BB.push([date, TL, ML, BL]);
				xData.push(date);
				yData.push([TL, ML, BL]);
			}

			return {
				values: BB,
				xData: xData,
				yData: yData
			};
		}
	});
}));
