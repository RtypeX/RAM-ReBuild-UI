using FastColoredTextBoxNS;
using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace RBX_Alt_Manager.Forms
{
    public partial class ThemeEditor : Form
    {
        public static Color AccountBackground = ColorTranslator.FromHtml("#162033");
        public static Color AccountForeground = ColorTranslator.FromHtml("#F8FAFC");

        public static Color ButtonsBackground = ColorTranslator.FromHtml("#1D2B44");
        public static Color ButtonsForeground = ColorTranslator.FromHtml("#F8FAFC");
        public static Color ButtonsBorder = ColorTranslator.FromHtml("#4F6B95");
        public static FlatStyle ButtonStyle = FlatStyle.Flat;

        public static Color FormsBackground = ColorTranslator.FromHtml("#0B1220");
        public static Color FormsForeground = ColorTranslator.FromHtml("#F8FAFC");
        public static bool UseDarkTopBar = true;
        public static bool ShowHeaders = true;

        public static Color TextBoxesBackground = ColorTranslator.FromHtml("#111A2B");
        public static Color TextBoxesForeground = ColorTranslator.FromHtml("#F8FAFC");
        public static Color TextBoxesBorder = ColorTranslator.FromHtml("#38506F");

        public static Color LabelBackground = ColorTranslator.FromHtml("#162033");
        public static Color LabelForeground = ColorTranslator.FromHtml("#D6E2F3");
        public static bool LabelTransparent = true;
        
        public static bool LightImages = false;
        // public static bool UseNormalTabControls = false;

        public static string ToHexString(Color c) => $"#{c.R:X2}{c.G:X2}{c.B:X2}";

        private static IniFile ThemeIni;
        private static IniSection Theme;

        public ThemeEditor()
        {
            AccountManager.SetDarkBar(Handle);

            InitializeComponent();
            this.Rescale();
        }

        public void ApplyTheme()
        {
            BackColor = FormsBackground;
            ForeColor = FormsForeground;
            Controls.ApplyTheme();
        }

        public static void LoadTheme()
        {
            ThemeIni ??= File.Exists(Path.Combine(Environment.CurrentDirectory, "RAMTheme.ini")) ? new IniFile("RAMTheme.ini") : new IniFile();

            Theme = ThemeIni.Section(Assembly.GetExecutingAssembly().GetName().Name);

            // bool.TryParse(Theme.Get("DisableCustomTabs"), out UseNormalTabControls);

            // if (!Theme.Exists("DisableCustomTabs")) { Theme.Set("DisableCustomTabs", "false"); ThemeIni.Save("RAMTheme.ini"); }

            if (Theme.Exists("AccountsBG")) AccountBackground = ColorTranslator.FromHtml(Theme.Get("AccountsBG"));
            if (Theme.Exists("AccountsFG")) AccountForeground = ColorTranslator.FromHtml(Theme.Get("AccountsFG"));

            if (Theme.Exists("ButtonsBG")) ButtonsBackground = ColorTranslator.FromHtml(Theme.Get("ButtonsBG"));
            if (Theme.Exists("ButtonsFG")) ButtonsForeground = ColorTranslator.FromHtml(Theme.Get("ButtonsFG"));
            if (Theme.Exists("ButtonsBC")) ButtonsBorder = ColorTranslator.FromHtml(Theme.Get("ButtonsBC"));
            if (Theme.Exists("ButtonStyle") && Enum.TryParse(Theme.Get("ButtonStyle"), out FlatStyle BS)) ButtonStyle = BS;

            if (Theme.Exists("FormsBG")) FormsBackground = ColorTranslator.FromHtml(Theme.Get("FormsBG"));
            if (Theme.Exists("FormsFG")) FormsForeground = ColorTranslator.FromHtml(Theme.Get("FormsFG"));
            if (Theme.Exists("DarkTopBar") && bool.TryParse(Theme.Get("DarkTopBar"), out bool DarkTopBar)) UseDarkTopBar = DarkTopBar;
            if (Theme.Exists("ShowHeaders") && bool.TryParse(Theme.Get("ShowHeaders"), out bool bShowHeaders)) ShowHeaders = bShowHeaders;

            if (Theme.Exists("TextBoxesBG")) TextBoxesBackground = ColorTranslator.FromHtml(Theme.Get("TextBoxesBG"));
            if (Theme.Exists("TextBoxesFG")) TextBoxesForeground = ColorTranslator.FromHtml(Theme.Get("TextBoxesFG"));
            if (Theme.Exists("TextBoxesBC")) TextBoxesBorder = ColorTranslator.FromHtml(Theme.Get("TextBoxesBC"));

            if (Theme.Exists("TextBoxesBG") && !Theme.Exists("LabelsTransparent")) LabelTransparent = false; // support old themes
            if (Theme.Exists("LabelsBC")) LabelBackground = ColorTranslator.FromHtml(Theme.Get("LabelsBC")); else LabelBackground = TextBoxesBackground;
            if (Theme.Exists("LabelsFC")) LabelForeground = ColorTranslator.FromHtml(Theme.Get("LabelsFC")); else LabelForeground = TextBoxesForeground;
            if (Theme.Exists("LabelsTransparent") && bool.TryParse(Theme.Get("LabelsTransparent"), out bool bLabelTransparent)) LabelTransparent = bLabelTransparent;

            if (!Theme.Exists("LightImages")) Theme.Set("LightImages", FormsBackground.GetBrightness() < 0.5 ? "true" : "false");
            if (bool.TryParse(Theme.Get("LightImages"), out bool bLightImages)) LightImages = bLightImages;

            if (!Theme.Exists("ThemeVersion") && IsLegacyDefaultTheme())
            {
                ApplyRefreshedDefaults();
                SaveTheme();
            }
        }

        public static void SaveTheme()
        {
            ThemeIni ??= File.Exists(Path.Combine(Environment.CurrentDirectory, "RAMTheme.ini")) ? new IniFile("RAMTheme.ini") : new IniFile();
            Theme ??= ThemeIni.Section(Assembly.GetExecutingAssembly().GetName().Name);

            Theme.Set("AccountsBG", ToHexString(AccountBackground));
            Theme.Set("AccountsFG", ToHexString(AccountForeground));

            Theme.Set("ButtonsBG", ToHexString(ButtonsBackground));
            Theme.Set("ButtonsFG", ToHexString(ButtonsForeground));
            Theme.Set("ButtonsBC", ToHexString(ButtonsBorder));
            Theme.Set("ButtonStyle", ButtonStyle.ToString());

            Theme.Set("FormsBG", ToHexString(FormsBackground));
            Theme.Set("FormsFG", ToHexString(FormsForeground));
            Theme.Set("DarkTopBar", UseDarkTopBar.ToString());
            Theme.Set("ShowHeaders", ShowHeaders.ToString());

            Theme.Set("TextBoxesBG", ToHexString(TextBoxesBackground));
            Theme.Set("TextBoxesFG", ToHexString(TextBoxesForeground));
            Theme.Set("TextBoxesBC", ToHexString(TextBoxesBorder));

            Theme.Set("LabelsBC", ToHexString(LabelBackground));
            Theme.Set("LabelsFC", ToHexString(LabelForeground));
            Theme.Set("LabelsTransparent", LabelTransparent.ToString());

            Theme.Set("LightImages", LightImages.ToString());
            Theme.Set("ThemeVersion", "2");

            ThemeIni.Save("RAMTheme.ini");
        }

        private static bool IsLegacyDefaultTheme() =>
            AccountBackground == ColorTranslator.FromHtml("#1E1F28") &&
            AccountForeground == ColorTranslator.FromHtml("#FFFFFF") &&
            ButtonsBackground == ColorTranslator.FromHtml("#292929") &&
            ButtonsForeground == ColorTranslator.FromHtml("#FFFFFF") &&
            ButtonsBorder == ColorTranslator.FromHtml("#282828") &&
            ButtonStyle == FlatStyle.Popup &&
            FormsBackground == ColorTranslator.FromHtml("#292929") &&
            FormsForeground == ColorTranslator.FromHtml("#FFFFFF") &&
            TextBoxesBackground == ColorTranslator.FromHtml("#3A3A3A") &&
            TextBoxesForeground == ColorTranslator.FromHtml("#FFFFFF") &&
            TextBoxesBorder == ColorTranslator.FromHtml("#282828");

        private static void ApplyRefreshedDefaults()
        {
            AccountBackground = ColorTranslator.FromHtml("#162033");
            AccountForeground = ColorTranslator.FromHtml("#F8FAFC");
            ButtonsBackground = ColorTranslator.FromHtml("#1D2B44");
            ButtonsForeground = ColorTranslator.FromHtml("#F8FAFC");
            ButtonsBorder = ColorTranslator.FromHtml("#4F6B95");
            ButtonStyle = FlatStyle.Flat;
            FormsBackground = ColorTranslator.FromHtml("#0B1220");
            FormsForeground = ColorTranslator.FromHtml("#F8FAFC");
            TextBoxesBackground = ColorTranslator.FromHtml("#111A2B");
            TextBoxesForeground = ColorTranslator.FromHtml("#F8FAFC");
            TextBoxesBorder = ColorTranslator.FromHtml("#38506F");
            LabelBackground = ColorTranslator.FromHtml("#162033");
            LabelForeground = ColorTranslator.FromHtml("#D6E2F3");
            LabelTransparent = true;
            LightImages = true;
            UseDarkTopBar = true;
            ShowHeaders = true;
        }

        private void SetBG_Click(object sender, EventArgs e)
        {
            string Selected = Selection.SelectedItem as string;

            if (string.IsNullOrEmpty(Selected)) return;

            if (SelectColor.ShowDialog() == DialogResult.OK)
            {
                switch (Selected)
                {
                    case "Accounts":
                        AccountBackground = SelectColor.Color;
                        break;

                    case "Buttons":
                        ButtonsBackground = SelectColor.Color;
                        break;

                    case "Forms":
                        FormsBackground = SelectColor.Color;
                        LightImages = FormsBackground.GetBrightness() < 0.5;
                        break;

                    case "Text Boxes":
                        TextBoxesBackground = SelectColor.Color;
                        break;

                    case "Labels":
                        LabelBackground = SelectColor.Color;
                        break;
                }

                AccountManager.Instance.ApplyTheme();
                SaveTheme();
            }
        }

        private void SetFG_Click(object sender, EventArgs e)
        {
            string Selected = Selection.SelectedItem as string;

            if (string.IsNullOrEmpty(Selected)) return;

            if (SelectColor.ShowDialog() == DialogResult.OK)
            {
                switch (Selected)
                {
                    case "Accounts":
                        AccountForeground = SelectColor.Color;
                        break;

                    case "Buttons":
                        ButtonsForeground = SelectColor.Color;
                        break;

                    case "Forms":
                        FormsForeground = SelectColor.Color;
                        break;

                    case "Text Boxes":
                        TextBoxesForeground = SelectColor.Color;
                        break;

                    case "Labels":
                        LabelForeground = SelectColor.Color;
                        break;
                }

                AccountManager.Instance.ApplyTheme();
                SaveTheme();
            }
        }

        private void ThemeEditor_FormClosing(object sender, FormClosingEventArgs e)
        {
            Hide();
            e.Cancel = true;
        }

        private void ShowControls(params Control[] controls)
        {
            SetBorder.Visible = false;
            ChangeStyle.Visible = false;
            HideHeaders.Visible = false;
            ToggleDarkTopBar.Visible = false;
            ToggleTransparentBG.Visible = false;

            foreach (Control control in controls)
                control.Visible = true;
        }

        private void Selection_SelectedIndexChanged(object sender, EventArgs e)
        {
            string Selected = Selection.SelectedItem as string;

            if (string.IsNullOrEmpty(Selected)) return;

            if (Selected == "Buttons")
                ShowControls(SetBorder, ChangeStyle);
            else if (Selected == "Text Boxes")
                ShowControls(SetBorder);
            else if (Selected == "Accounts")
                ShowControls(HideHeaders);
            else if (Selected == "Forms")
                ShowControls(ToggleDarkTopBar);
            else if (Selected == "Labels")
                ShowControls(ToggleTransparentBG);
            else
                ShowControls();
        }

        private void SetBorder_Click(object sender, EventArgs e)
        {
            string Selected = Selection.SelectedItem as string;

            if (string.IsNullOrEmpty(Selected)) return;

            if (SelectColor.ShowDialog() == DialogResult.OK)
            {
                switch (Selected)
                {
                    case "Buttons":
                        ButtonsBorder = SelectColor.Color;
                        break;

                    case "Text Boxes":
                        TextBoxesBorder = SelectColor.Color;
                        break;
                }

                AccountManager.Instance.ApplyTheme();
                SaveTheme();
            }
        }

        private void ChangeStyle_Click(object sender, EventArgs e)
        {
            ButtonStyle = ButtonStyle.Next();
            AccountManager.Instance.ApplyTheme();
            SaveTheme();
        }

        private void HideHeaders_Click(object sender, EventArgs e)
        {
            ShowHeaders = !ShowHeaders;
            AccountManager.Instance.ApplyTheme();
            SaveTheme();
        }

        private void ToggleTransparentBG_Click(object sender, EventArgs e)
        {
            LabelTransparent = !LabelTransparent;
            AccountManager.Instance.ApplyTheme();
            SaveTheme();
        }

        private void ToggleDarkTopBar_Click(object sender, EventArgs e)
        {
            UseDarkTopBar = !UseDarkTopBar;
            SaveTheme();
            MessageBox.Show("This option requires RAM to be restarted.\nThis may not work on older versions of windows.\nEnabled: " + (UseDarkTopBar ? "True" : "false"), "Roblox Account Manager", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
