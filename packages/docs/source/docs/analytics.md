---
title: Bot Analytics
date: 2025-11-07T16:30:00.000Z
---

# Bot Performance Analytics

This page displays performance metrics for the Screeps GPT bot over the last 30 days.

<div id="analytics-container">
  <p class="loading-message">Loading analytics data...</p>
</div>

<!-- Chart.js v4.x is loaded from jsDelivr CDN.
     Version 4.4.0 is explicitly specified for stability and predictability.
     When a new major version is released, review breaking changes before updating.
     SRI hash ensures the script hasn't been tampered with. -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" integrity="sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g" crossorigin="anonymous"></script>
<script>
(async function() {
  try {
    const response = await fetch('./analytics/data.json');
    const data = await response.json();
    
    const container = document.getElementById('analytics-container');
    
    if (!data.dataPoints || data.dataPoints.length === 0) {
      container.innerHTML = '<p class="info-message">No analytics data available yet. Data will appear once the monitoring system starts collecting snapshots.</p>';
      return;
    }
    
    // Prepare data
    const labels = data.dataPoints.map(d => d.date);
    
    // Create charts container
    container.innerHTML = `
      <div class="analytics-summary">
        <p><strong>Data Period:</strong> ${data.period}</p>
        <p><strong>Last Updated:</strong> ${new Date(data.generated).toLocaleString()}</p>
        <p><strong>Data Points:</strong> ${data.dataPoints.length}</p>
      </div>
      
      <div class="chart-container">
        <h2>CPU Usage</h2>
        <canvas id="cpuChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>CPU Bucket</h2>
        <canvas id="bucketChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Creep Count</h2>
        <canvas id="creepChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Room Statistics</h2>
        <canvas id="roomChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Controller Progress</h2>
        <canvas id="controllerChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Infrastructure</h2>
        <canvas id="infrastructureChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Memory Usage</h2>
        <canvas id="memoryChart"></canvas>
      </div>
    `;
    
    // CPU Usage Chart
    if (data.dataPoints.some(d => d.cpuUsed !== undefined)) {
      new Chart(document.getElementById('cpuChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'CPU Used',
            data: data.dataPoints.map(d => d.cpuUsed),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'CPU'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // CPU Bucket Chart
    if (data.dataPoints.some(d => d.cpuBucket !== undefined)) {
      new Chart(document.getElementById('bucketChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'CPU Bucket',
            data: data.dataPoints.map(d => d.cpuBucket),
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Bucket'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Creep Count Chart
    if (data.dataPoints.some(d => d.creepCount !== undefined)) {
      new Chart(document.getElementById('creepChart'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Creep Count',
            data: data.dataPoints.map(d => d.creepCount),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Count'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Room Statistics Chart
    if (data.dataPoints.some(d => d.roomCount !== undefined || d.averageRcl !== undefined)) {
      const datasets = [];
      
      if (data.dataPoints.some(d => d.roomCount !== undefined)) {
        datasets.push({
          label: 'Room Count',
          data: data.dataPoints.map(d => d.roomCount),
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.1)',
          tension: 0.3,
          yAxisID: 'y'
        });
      }
      
      if (data.dataPoints.some(d => d.averageRcl !== undefined)) {
        datasets.push({
          label: 'Average RCL',
          data: data.dataPoints.map(d => d.averageRcl !== undefined ? parseFloat(d.averageRcl.toFixed(1)) : null),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.3,
          yAxisID: 'y1'
        });
      }
      
      new Chart(document.getElementById('roomChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Room Count'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              max: 8,
              title: {
                display: true,
                text: 'Average RCL'
              },
              grid: {
                drawOnChartArea: false,
              },
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Controller Progress Chart
    if (data.dataPoints.some(d => d.controllerProgress !== undefined)) {
      new Chart(document.getElementById('controllerChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Controller Progress',
            data: data.dataPoints.map(d => d.controllerProgress),
            borderColor: 'rgb(46, 204, 113)',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            fill: true,
            tension: 0.3
          }, {
            label: 'Progress Goal',
            data: data.dataPoints.map(d => d.controllerProgressTotal),
            borderColor: 'rgb(231, 76, 60)',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            borderDash: [5, 5],
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Progress Points'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Infrastructure Chart
    if (data.dataPoints.some(d => d.containerCount !== undefined || d.roadCount !== undefined || d.towerCount !== undefined || d.extensionCount !== undefined)) {
      const infraDatasets = [];
      
      if (data.dataPoints.some(d => d.extensionCount !== undefined)) {
        infraDatasets.push({
          label: 'Extensions',
          data: data.dataPoints.map(d => d.extensionCount),
          backgroundColor: 'rgba(255, 206, 86, 0.7)',
          borderColor: 'rgb(255, 206, 86)',
          borderWidth: 1
        });
      }
      
      if (data.dataPoints.some(d => d.containerCount !== undefined)) {
        infraDatasets.push({
          label: 'Containers',
          data: data.dataPoints.map(d => d.containerCount),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        });
      }
      
      if (data.dataPoints.some(d => d.towerCount !== undefined)) {
        infraDatasets.push({
          label: 'Towers',
          data: data.dataPoints.map(d => d.towerCount),
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 1
        });
      }
      
      if (data.dataPoints.some(d => d.spawnCount !== undefined)) {
        infraDatasets.push({
          label: 'Spawns',
          data: data.dataPoints.map(d => d.spawnCount),
          backgroundColor: 'rgba(153, 102, 255, 0.7)',
          borderColor: 'rgb(153, 102, 255)',
          borderWidth: 1
        });
      }
      
      new Chart(document.getElementById('infrastructureChart'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: infraDatasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            x: {
              stacked: true,
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Count'
              }
            }
          }
        }
      });
    }
    
    // Memory Usage Chart
    if (data.dataPoints.some(d => d.memoryUsed !== undefined)) {
      new Chart(document.getElementById('memoryChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Memory Used (bytes)',
            data: data.dataPoints.map(d => d.memoryUsed),
            borderColor: 'rgb(155, 89, 182)',
            backgroundColor: 'rgba(155, 89, 182, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          }, {
            label: 'Memory Used (%)',
            data: data.dataPoints.map(d => d.memoryUsedPercent),
            borderColor: 'rgb(52, 73, 94)',
            backgroundColor: 'rgba(52, 73, 94, 0.1)',
            tension: 0.3,
            yAxisID: 'y1'
          }]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Bytes'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Percent'
              },
              grid: {
                drawOnChartArea: false,
              },
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Failed to load analytics:', error);
    document.getElementById('analytics-container').innerHTML = 
      '<p class="error-message">Failed to load analytics data. Please try again later.</p>';
  }
})();
</script>

<style>
.analytics-summary {
  background: #f5f5f5;
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 4px;
}

.analytics-summary p {
  margin: 0.5rem 0;
}

.chart-container {
  margin-bottom: 3rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-container h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.5rem;
}

.loading-message {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.info-message {
  text-align: center;
  padding: 2rem;
  color: #666;
  background: #f0f0f0;
  border-radius: 4px;
}

.error-message {
  text-align: center;
  padding: 2rem;
  color: #d32f2f;
  background: #ffebee;
  border-radius: 4px;
}

canvas {
  max-height: 400px;
}
</style>
