using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace SharePlateLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string projectRoot = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(projectRoot, "package.json")))
            {
                DirectoryInfo parent = Directory.GetParent(projectRoot);
                if (parent != null && File.Exists(Path.Combine(parent.FullName, "package.json")))
                {
                    projectRoot = parent.FullName;
                }
            }

            // 1. Check if Metro/Expo Web is already responding on port 8081
            bool isRunning = IsPortOpen("http://127.0.0.1:8081");

            if (!isRunning)
            {
                // Start background process
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c npm run web -w apps/mobile";
                psi.WorkingDirectory = projectRoot;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process.Start(psi);

                // Wait up to 15 seconds for server readiness
                for (int i = 0; i < 30; i++)
                {
                    Thread.Sleep(500);
                    if (IsPortOpen("http://127.0.0.1:8081"))
                    {
                        isRunning = true;
                        break;
                    }
                }
            }

            // 2. Locate Edge or Chrome to run in dedicated Mobile Phone Window mode (--app)
            string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            string browserPath = File.Exists(edgePath) ? edgePath : (File.Exists(chromePath) ? chromePath : null);

            string mobileUrl = "http://localhost:8081";

            if (browserPath != null)
            {
                string tempProfile = Path.Combine(Path.GetTempPath(), "SharePlateMobileProfile");
                ProcessStartInfo bPsi = new ProcessStartInfo();
                bPsi.FileName = browserPath;
                bPsi.Arguments = string.Format("--app=\"{0}\" --window-size=430,880 --user-data-dir=\"{1}\"", mobileUrl, tempProfile);
                Process.Start(bPsi);
            }
            else
            {
                Process.Start(mobileUrl);
            }
        }

        static bool IsPortOpen(string url)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Timeout = 1000;
                request.Method = "GET";
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
