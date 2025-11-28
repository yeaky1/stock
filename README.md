# 📈 AlphaQuant Pro - A-Share Quantitative Backtesting Platform

![React](https://img.shields.io/badge/React-18.0-blue?style=flat-square&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38bdf8?style=flat-square&logo=tailwindcss)
![Recharts](https://img.shields.io/badge/Visualization-Recharts-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**AlphaQuant Pro** is a modern, interactive backtesting engine for the A-Share market, built with React. 

It provides a professional dashboard to visualize historical data, simulate trading strategies (MACD & Bollinger Bands), and analyze performance metrics. The platform features a unique data handling system that supports direct API connections, deterministic simulations, and a local Python bridge to bypass browser CORS restrictions.

## ✨ Key Features

* **📊 Interactive Visualization**: High-performance composed charts powered by `Recharts`, overlaying candlestick data with technical indicators (Upper/Lower Bands, Moving Averages).
* **🧠 Dual Strategy Engine**:
    * **Bollinger Bands**: Mean reversion strategy (Buy on Lower Band touch, Sell on Upper Band touch).
    * **MACD**: Trend following strategy (Buy on Golden Cross, Sell on Death Cross).
* **🛠 Dynamic Parameter Tuning**: Adjust strategy parameters (Window, StdDev, Fast/Slow periods) in real-time and instantly observe changes in the equity curve.
* **💾 Flexible Data Sources**:
    * **Mock Mode**: Deterministic, seed-based simulation for instant demos without API keys.
    * **Python Bridge**: Built-in generator for **Baostock/Tushare** scripts to fetch real data locally and import via JSON (solves browser CORS issues).
    * **Tushare API**: Direct integration for users with valid tokens and proxy configurations.
* **📉 Comprehensive Metrics**: Automatic calculation of **Total Return**, **Max Drawdown**, **Win Rate**, **Total Trades**, and **Final Equity**.
* **🎨 Professional UI**: Fully responsive Dark Mode design using Tailwind CSS with Lucide icons.

## 🚀 Tech Stack

* **Framework**: [React](https://reactjs.org/) (Vite/CRA)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Charts**: [Recharts](https://recharts.org/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Data Logic**: Pure JavaScript implementation of financial algorithms.

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/your-username/alpha-quant-pro.git](https://github.com/your-username/alpha-quant-pro.git)
    cd alpha-quant-pro
    ```

2.  **Install dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Start the local server**
    ```bash
    npm start
    # or
    yarn dev
    ```

4.  **Access the app**
    Open `http://localhost:3000` in your browser.

## 📖 Usage Guide

### 1. Data Acquisition (The "Python Bridge")
Since web browsers restrict direct cross-origin requests (CORS) to some financial APIs (like Baostock), this platform includes a helper tool:

* Select **"Baostock"** or **"Tushare"** in the settings panel.
* Click **"Get Data Script"**.
* The app generates a Python snippet based on your selected stock and date range.
* Run the script locally:
    ```bash
    # Ensure you have dependencies installed
    pip install baostock pandas tushare
    python fetch_data.py
    ```
* Copy the JSON output from your terminal and paste it into the **"Manual Import"** box in the web app.

### 2. Strategy Configuration
You can toggle between strategies and adjust their sensitivity:

| Strategy | Parameter | Description |
| :--- | :--- | :--- |
| **Bollinger** | `Period` | The moving average window (N days). |
| **Bollinger** | `Multiplier` | Standard deviation multiplier (Width of bands). |
| **MACD** | `Fast (Short)` | Fast EMA period (Default: 12). |
| **MACD** | `Slow (Long)` | Slow EMA period (Default: 26). |
| **MACD** | `Signal` | DEA Signal line period (Default: 9). |

### 3. Analyzing Results
* **Chart Tab**: View Buy/Sell signals directly on the K-line chart.
* **Equity Tab**: Track the growth of your capital over time.
* **Trades Tab**: detailed log of every transaction, including execution price and reasoning.

## 📸 Screenshots

<div align="center">
  <img src="https://via.placeholder.com/800x400?text=Dashboard+Preview" alt="Dashboard Screenshot" width="800"/>
</div>

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/your-username">Your Name</a></p>
</div>
