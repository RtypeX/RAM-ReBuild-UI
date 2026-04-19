using BrightIdeasSoftware;
using Microsoft.WindowsAPICodePack.Dialogs;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RBX_Alt_Manager;
using RBX_Alt_Manager.Classes;
using RBX_Alt_Manager.Forms;
using RestSharp;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

public static class Utilities
{
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, UInt32 Msg, int wParam, int lParam);

    [DllImport("wininet.dll")]
    private extern static bool InternetGetConnectedState(out int Description, int ReservedValue);

    public static T Next<T>(this T src) where T : struct
    {
        if (!typeof(T).IsEnum) throw new ArgumentException(string.Format("Argument {0} is not an Enum", typeof(T).FullName));

        T[] Arr = (T[])Enum.GetValues(src.GetType());
        int j = Array.IndexOf<T>(Arr, src) + 1;
        return (Arr.Length == j) ? Arr[0] : Arr[j];
    }

    public static T Clamp<T>(this T val, T min, T max) where T : IComparable<T>
    {
        if (val.CompareTo(min) < 0) return min;
        else if (val.CompareTo(max) > 0) return max;
        else return val;
    }

    public static Control GetSource(this ToolStripMenuItem item) => item?.Owner is ContextMenuStrip strip ? strip.SourceControl : null;

    public static bool TryParseJson<T>(this string @this, out T result) // https://stackoverflow.com/a/51428508
    {
        bool success = true;
        var settings = new JsonSerializerSettings
        {
            Error = (sender, args) => { success = false; args.ErrorContext.Handled = true; },
            MissingMemberHandling = MissingMemberHandling.Error
        };
        result = JsonConvert.DeserializeObject<T>(@this, settings);
        return success;
    }

    public static void InvokeIfRequired(this Control _Control, MethodInvoker _Action)
    {
        if (_Control.InvokeRequired)
            _Control.Invoke(_Action);
        else
            _Action();
    }

    public static string MD5(string input)
    {
        MD5 md5 = System.Security.Cryptography.MD5.Create();
        byte[] inputBytes = Encoding.ASCII.GetBytes(input);
        byte[] hashBytes = md5.ComputeHash(inputBytes);

        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < hashBytes.Length; i++)
            sb.Append(hashBytes[i].ToString("X2"));

        return sb.ToString();
    }

    public static string FileSHA256(this string FileName)
    {
        if (!File.Exists(FileName)) return "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855";

        using SHA256 SHA256 = SHA256.Create();
        using FileStream fileStream = File.OpenRead(FileName);

        return BitConverter.ToString(SHA256.ComputeHash(fileStream)).Replace("-", "");
    }

public static Color Lerp(this Color s, Color t, float k)
    {
        var bk = 1 - k;
        var a = s.A * bk + t.A * k;
        var r = s.R * bk + t.R * k;
        var g = s.G * bk + t.G * k;
        var b = s.B * bk + t.B * k;

        return Color.FromArgb((int)a, (int)r, (int)g, (int)b);
    }

    public static double ToRobloxTick(this DateTime Date) => ((Date - Epoch).Ticks / TimeSpan.TicksPerSecond) + ((double)Date.Millisecond / 1000);

    public static string GetCommandLine(this Process process)
    {
        using ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId = " + process.Id);
        using ManagementObjectCollection objects = searcher.Get();
        return objects.Cast<ManagementBaseObject>().SingleOrDefault()?["CommandLine"]?.ToString();
    }

    public static async Task<string> GetRandomJobId(long PlaceId, bool ChooseLowestServer = false)
    {
        Random RNG = new Random();
        List<string> ValidServers = new List<string>();
        int StopAt = Math.Max(AccountManager.General.Get<int>("ShufflePageCount"), 1);
        int PageCount = 0;

        async Task GetServers(string Cursor = "")
        {
            if (PageCount >= StopAt) return;

            PageCount++;

            RestRequest request = new RestRequest("v1/games/" + PlaceId + "/servers/public?sortOrder=Asc&limit=100" + (string.IsNullOrEmpty(Cursor) ? "" : "&cursor=" + Cursor), Method.Get);
            var response = await ServerList.GamesClient?.ExecuteAsync(request);

            if (response == null || !response.IsSuccessful) return;

            JObject Servers = JObject.Parse(response.Content);

            if (!Servers.ContainsKey("data")) return;

            Cursor = Servers["nextPageCursor"]?.Value<string>() ?? string.Empty;

            foreach (JToken a in Servers["data"])
                if (a["playing"]?.Value<int>() != a["maxPlayers"]?.Value<int>() && a["playing"]?.Value<int>() > 0 && a["maxPlayers"]?.Value<int>() > 1)
                    ValidServers.Add(a["id"].Value<string>());

            if (!string.IsNullOrEmpty(Cursor) && !ChooseLowestServer)
                await GetServers(Cursor);
        }

        await GetServers();

        if (ValidServers.Count == 0) return string.Empty;

        return ValidServers[ChooseLowestServer ? 0 : RNG.Next(ValidServers.Count)];
    }

    // probably not the best way to do it but it works so whatever
    public static void Rescale(this Control control, bool UseControlFont = false)
    {
        if (control.Tag is string Tag && Tag == "NoScaling") return;

        if (Program.ScaleFonts)
        {
            Font font = control.FindForm()?.Font ?? SystemFonts.DefaultFont;

            if (UseControlFont) font = control?.Font;

            control.Font = new Font(font.FontFamily.Name, font.SizeInPoints * Program.Scale);
        }

        if (control is Button btn && btn.Image != null)
            btn.Image = new Bitmap(btn.Image, new Size((int)(btn.Image.Width * Program.Scale), (int)(btn.Image.Height * Program.Scale)));

        if (control is TabControl tc && Program.Scale > 1)
            foreach (TabPage tab in tc.Controls)
                tab.Text = tab.Text.PadRight((int)(2 + tab.Text.Length * Program.Scale)); // Bad. Very Bad. But it works...

        if (control is ObjectListView olv)
            foreach (OLVColumn col in olv.Columns)
                col.Width = (int)(col.Width * Program.Scale);
    }

    public static void Rescale(this Form form)
    {
        form.MaximumSize = new Size((int)(form.MaximumSize.Width * Program.Scale), (int)(form.MaximumSize.Height * Program.Scale));
        form.Scale(new SizeF(Program.Scale, Program.Scale));

        static void RescaleControls(Control.ControlCollection controls)
        {
            foreach (Control control in controls)
            {
                control.Rescale(control is ObjectListView || (control.Tag is string Tag && Tag == "UseControlFont"));

                RescaleControls(control.Controls);
            }
        }

        RescaleControls(form.Controls);
    }

    public static void RecursiveDelete(this DirectoryInfo baseDir)
    {
        if (!baseDir.Exists)
            return;

        foreach (var dir in baseDir.EnumerateDirectories())
            RecursiveDelete(dir);

        foreach (var file in baseDir.GetFiles())
        {
            file.IsReadOnly = false;
            file.Delete();
        }

        baseDir.Delete(true);
    }

    public static bool YesNoPrompt(string Caption, string Instruction, string Text, bool CanSave = true, bool SaveIfNo = true)
    {
        string Hash = MD5($"{Caption}.{Instruction}.{Text}");

        if (CanSave && AccountManager.Prompts.Exists(Hash))
            return AccountManager.Prompts.Get<bool>(Hash);

        TaskDialog Dialog = TaskDialog.IsPlatformSupported == true ? new TaskDialog()
        {
            Caption = Caption,
            InstructionText = Instruction,
            Text = Text,
            FooterCheckBoxText = CanSave ? "Don't show this again and remember my choice" : null,
            StandardButtons = TaskDialogStandardButtons.Yes | TaskDialogStandardButtons.No,
        } : null;

        var DR = Dialog?.Show();

        if (CanSave && Dialog?.FooterCheckBoxChecked == true)
        {
            if (SaveIfNo || (!SaveIfNo && DR == TaskDialogResult.Yes))
            {
                AccountManager.Prompts.Set(Hash, DR == TaskDialogResult.Yes ? "true" : "false");
                AccountManager.IniSettings.Save("RAMSettings.ini");
            }
        }

        return DR != null ? DR == TaskDialogResult.Yes : MessageBox.Show($"{Instruction}\n{Text}", Caption, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes;
    }

    public static void ApplyTheme(this Control.ControlCollection Controls)
    {
        foreach (Control control in Controls)
        {
            control.ApplyTheme();
        }
    }

    public static void ApplyTheme(this Control control)
    {
        if (control == null)
            return;

        if (!(control.Tag is string tag && tag == "UseControlFont"))
            ApplyControlFont(control);

        if (control.ContextMenuStrip != null)
            control.ContextMenuStrip.ApplyTheme();

        if (control is MenuButton menuButton && menuButton.Menu != null)
            menuButton.Menu.ApplyTheme();

        if (control is PictureBox)
        {
            control.BackColor = Color.Transparent;

            if (ThemeEditor.LightImages && control.GetLuminance(out float luminance) && luminance < 0.3)
                control.ColorImage(255, 255, 255);
        }
        else if (control is Button button)
            ApplyButtonTheme(button);
        else if (control is CheckBox checkBox)
            ApplyCheckBoxTheme(checkBox);
        else if (control is TextBox || control is RichTextBox)
            ApplyTextInputTheme(control);
        else if (control is LinkLabel linkLabel)
            ApplyLinkLabelTheme(linkLabel);
        else if (control is Label)
            ApplyLabelTheme(control);
        else if (control is GroupBox groupBox)
            ApplyGroupBoxTheme(groupBox);
        else if (control is ListBox listBox)
            ApplyListBoxTheme(listBox);
        else if (control is ObjectListView objectListView)
            ApplyObjectListViewTheme(objectListView);
        else if (control is ProgressBar)
            control.BackColor = ThemeEditor.LabelBackground;
        else if (control is TabControl tabControl)
            ApplyTabControlTheme(tabControl);
        else if (control is TabPage tabPage)
            ApplyTabPageTheme(tabPage);
        else if (control is Panel || control is FlowLayoutPanel || control is SplitContainer || control is UserControl)
            ApplyContainerTheme(control);
        else if (control is FastColoredTextBoxNS.FastColoredTextBox)
            control.ForeColor = Color.Black;

        if (control.HasChildren)
            control.Controls.ApplyTheme();
    }

    public static void ApplyTheme(this ToolStrip strip)
    {
        if (strip == null)
            return;

        strip.Renderer = new ThemedToolStripRenderer();
        strip.BackColor = GetMenuBackground();
        strip.ForeColor = ThemeEditor.ButtonsForeground;
        strip.Font = GetControlFont(strip.Font, 0f, FontStyle.Regular);
        strip.Padding = strip is MenuStrip ? new Padding(8, 4, 8, 4) : new Padding(2);

        ApplyTheme(strip.Items);
    }

    public static void ApplyTheme(this ToolStripItemCollection items)
    {
        if (items == null)
            return;

        foreach (ToolStripItem item in items)
        {
            item.BackColor = GetMenuBackground();
            item.ForeColor = ThemeEditor.ButtonsForeground;
            item.Font = GetControlFont(item.Font, 0f, item is ToolStripMenuItem ? FontStyle.Regular : FontStyle.Regular);

            if (item is ToolStripDropDownItem dropDownItem)
            {
                dropDownItem.DropDown.BackColor = GetMenuBackground();
                dropDownItem.DropDown.ForeColor = ThemeEditor.ButtonsForeground;
                dropDownItem.DropDown.Renderer = new ThemedToolStripRenderer();
                ApplyTheme(dropDownItem.DropDownItems);
            }
        }
    }

    private static void ApplyButtonTheme(Button button)
    {
        if (ThemeEditor.LightImages && button.GetLuminance(out float luminance) && luminance < 0.3)
            button.ColorImage(255, 255, 255);

        button.FlatStyle = FlatStyle.Flat;
        button.UseVisualStyleBackColor = false;
        button.BackColor = ThemeEditor.ButtonsBackground;
        button.ForeColor = ThemeEditor.ButtonsForeground;
        button.FlatAppearance.BorderColor = ThemeEditor.ButtonsBorder;
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.MouseOverBackColor = ThemeEditor.ButtonsBackground.Lerp(Color.White, 0.08f);
        button.FlatAppearance.MouseDownBackColor = ThemeEditor.ButtonsBackground.Lerp(Color.Black, 0.15f);

        if (button is MenuButton)
            button.Padding = new Padding(10, 0, 24, 0);
        else if (button.Padding == Padding.Empty)
            button.Padding = new Padding(10, 0, 10, 0);
    }

    private static void ApplyCheckBoxTheme(CheckBox checkBox)
    {
        checkBox.BackColor = Color.Transparent;
        checkBox.ForeColor = ThemeEditor.ButtonsForeground;
        checkBox.FlatStyle = FlatStyle.Standard;
        checkBox.UseVisualStyleBackColor = false;
    }

    private static void ApplyTextInputTheme(Control control)
    {
        if (control is BorderedTextBox borderedTextBox)
            borderedTextBox.BorderColor = ThemeEditor.TextBoxesBorder;

        if (control is BorderedRichTextBox borderedRichTextBox)
            borderedRichTextBox.BorderColor = ThemeEditor.TextBoxesBorder;

        control.BackColor = ThemeEditor.TextBoxesBackground;
        control.ForeColor = ThemeEditor.TextBoxesForeground;
    }

    private static void ApplyLabelTheme(Control control)
    {
        control.BackColor = ThemeEditor.LabelTransparent ? Color.Transparent : ThemeEditor.LabelBackground;
        control.ForeColor = ThemeEditor.LabelForeground;
    }

    private static void ApplyLinkLabelTheme(LinkLabel linkLabel)
    {
        linkLabel.BackColor = ThemeEditor.LabelTransparent ? Color.Transparent : ThemeEditor.LabelBackground;
        linkLabel.ForeColor = ThemeEditor.LabelForeground;
        linkLabel.LinkColor = ThemeEditor.LabelForeground;
        linkLabel.ActiveLinkColor = ThemeEditor.ButtonsForeground.Lerp(Color.White, 0.15f);
        linkLabel.VisitedLinkColor = ThemeEditor.LabelForeground.Lerp(ThemeEditor.ButtonsBorder, 0.35f);
    }

    private static void ApplyGroupBoxTheme(GroupBox groupBox)
    {
        groupBox.BackColor = GetContainerBackground();
        groupBox.ForeColor = ThemeEditor.LabelForeground;
    }

    private static void ApplyContainerTheme(Control control)
    {
        if (control.Parent is Form)
            control.BackColor = ThemeEditor.FormsBackground;
        else if (!(control is SplitContainer))
            control.BackColor = GetContainerBackground();

        control.ForeColor = ThemeEditor.FormsForeground;
    }

    private static void ApplyListBoxTheme(ListBox listBox)
    {
        listBox.BackColor = GetContainerBackground();
        listBox.ForeColor = ThemeEditor.ButtonsForeground;
        listBox.BorderStyle = BorderStyle.FixedSingle;
    }

    private static void ApplyObjectListViewTheme(ObjectListView view)
    {
        Color listBackground = ThemeEditor.AccountBackground;
        Color alternateRow = listBackground.Lerp(Color.White, 0.04f);
        Color selectedBackground = ThemeEditor.ButtonsBorder.Lerp(ThemeEditor.ButtonsBackground, 0.35f);

        view.BackColor = listBackground;
        view.ForeColor = ThemeEditor.AccountForeground;
        view.BorderStyle = BorderStyle.None;
        view.HeaderStyle = ThemeEditor.ShowHeaders ? (view.ShowGroups ? ColumnHeaderStyle.Nonclickable : ColumnHeaderStyle.Clickable) : ColumnHeaderStyle.None;
        view.GridLines = false;
        view.FullRowSelect = true;
        view.HideSelection = false;

        TrySetProperty(view, "UseCustomSelectionColors", true);
        TrySetProperty(view, "UseAlternatingBackColors", true);
        TrySetProperty(view, "AlternateRowBackColor", alternateRow);
        TrySetProperty(view, "AlternateRowBackColorOrDefault", alternateRow);
        TrySetProperty(view, "SelectedBackColor", selectedBackground);
        TrySetProperty(view, "SelectedForeColor", ThemeEditor.AccountForeground);
        TrySetProperty(view, "HighlightBackgroundColor", selectedBackground);
        TrySetProperty(view, "HighlightForegroundColor", ThemeEditor.AccountForeground);
        TrySetProperty(view, "HeaderUsesThemes", false);
    }

    private static void ApplyTabControlTheme(TabControl tabControl)
    {
        tabControl.BackColor = ThemeEditor.FormsBackground;
        tabControl.ForeColor = ThemeEditor.ButtonsForeground;

        foreach (TabPage page in tabControl.TabPages)
            ApplyTabPageTheme(page);
    }

    private static void ApplyTabPageTheme(TabPage tabPage)
    {
        tabPage.BackColor = GetContainerBackground();
        tabPage.ForeColor = ThemeEditor.ButtonsForeground;
    }

    private static void ApplyControlFont(Control control)
    {
        if (control.Font == null)
            return;

        FontStyle style = control is Button || control is MenuButton ? FontStyle.Bold : control.Font.Style;
        control.Font = GetControlFont(control.Font, 0f, style);
    }

    private static Font GetControlFont(Font currentFont, float sizeOffset, FontStyle style)
    {
        currentFont ??= SystemFonts.DefaultFont;

        string familyName = FontFamily.Families.Any(f => f.Name == "Segoe UI") ? "Segoe UI" : currentFont.FontFamily.Name;
        return new Font(familyName, currentFont.Size + sizeOffset, style, GraphicsUnit.Point);
    }

    private static bool TrySetProperty(object target, string propertyName, object value)
    {
        PropertyInfo property = target?.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);

        if (property == null || !property.CanWrite)
            return false;

        property.SetValue(target, value);
        return true;
    }

    private static Color GetContainerBackground() => ThemeEditor.AccountBackground.Lerp(ThemeEditor.FormsBackground, 0.4f);

    private static Color GetMenuBackground() => ThemeEditor.FormsBackground.Lerp(ThemeEditor.ButtonsBackground, 0.5f);

    public static Color DarkenOrBrighten(this Color color, float Percent) => color.GetBrightness() < 0.5 ? ControlPaint.Light(color, Percent) : ControlPaint.Dark(color, Percent);

    public static double MapValue(double Input, double IL, double IH, double OL, double OH) => (Input - IL) / (IH - IL) * (OH - OL) + OL;

    private static readonly DateTime Epoch = new DateTime(1970, 1, 1);

    public static bool IsConnectedToInternet() => InternetGetConnectedState(out int _, 0);

}

public static class ImageExtensions
{
    /// <summary>
    /// Changes the colors of every pixel in an image
    /// </summary>
    /// <param name="control">Control containing an Image to color</param>
    /// <param name="R">Red</param>
    /// <param name="G">Green</param>
    /// <param name="B">Blue</param>
    public static void ColorImage(this Control control, int R, int G, int B)
    {
        Bitmap Image = control.GetImage(out PropertyInfo ImageProperty);

        for (int x = 0; x < Image.Width; x++)
            for (int y = 0; y < Image.Height; y++)
            {
                Color Pixel = Image.GetPixel(x, y);

                if (Pixel.A == 0) continue;

                Pixel = Color.FromArgb(Pixel.A, R, G, B);
                Image.SetPixel(x, y, Pixel);
            }

        ImageProperty.SetValue(control, Image); // Required for some controls
    }

    /// <summary>
    /// Obtain the Image Bitmap of a Control
    /// </summary>
    /// <param name="control">Control containing an Image</param>
    /// <param name="ImageProperty">PropertyInfo of the Image Property</param>
    /// <returns>Returns the Image Bitmap of a Control</returns>
    /// <exception cref="ArgumentException">Control doesn't contain the Image Property</exception>
    public static Bitmap GetImage(this Control control, out PropertyInfo ImageProperty)
    {
        List<PropertyInfo> Properties = control.GetType().GetProperties().ToList();
        ImageProperty = Properties.FirstOrDefault(Property => Property.Name == "Image");

        if (ImageProperty == null) throw new ArgumentException("Control passed does not contain Image property");

        object ImageObject = ImageProperty.GetValue(control); if (ImageObject == null) return null;

        return ImageObject as Bitmap;
    }

    /// <summary>
    /// Get the average Luminance of a Control's Image
    /// </summary>
    /// <param name="control">Control containing an Image</param>
    /// <param name="Luminance">Average Luminance of a Control's Image</param>
    /// <returns>Returns false if Control doesn't contain an Image</returns>
    public static bool GetLuminance(this Control control, out float Luminance)
    {
        Luminance = 0f;
        Bitmap Image = control.GetImage(out _);

        if (Image == null) return false;

        for (int x = 0; x < Image.Width; x++)
            for (int y = 0; y < Image.Height; y++)
            {
                Color Pixel = Image.GetPixel(x, y);

                if (Pixel.A == 0) continue;

                Luminance += Pixel.GetBrightness();
            }

        Luminance /= (Image.Width * Image.Height);

        return true;
    }

    public static bool IsImageMostlyDark(this Control control, double Threshold = 0.25) => control.GetLuminance(out float Luminance) && Luminance < Threshold;
}

public static class HttpExtensions
{
    // https://stackoverflow.com/a/46497896
    public static async Task DownloadAsync(this HttpClient client, string requestUri, Stream destination, IProgress<float> progress = null, CancellationToken cancellationToken = default)
    {
        // Get the http headers first to examine the content length
        using var response = await client.GetAsync(requestUri, HttpCompletionOption.ResponseHeadersRead);
        var contentLength = response.Content.Headers.ContentLength;

        using var download = await response.Content.ReadAsStreamAsync();
        // Ignore progress reporting when no progress reporter was 
        // passed or when the content length is unknown
        if (progress == null || !contentLength.HasValue)
        {
            await download.CopyToAsync(destination);
            return;
        }

        // Convert absolute progress (bytes downloaded) into relative progress (0% - 100%)
        var relativeProgress = new Progress<long>(totalBytes => progress.Report((float)totalBytes / contentLength.Value));
        // Use extension method to report progress while downloading
        await CopyToAsync(download, destination, 81920, relativeProgress, cancellationToken);
        progress.Report(1);
    }

    public static async Task CopyToAsync(Stream source, Stream destination, int bufferSize, IProgress<long> progress = null, CancellationToken cancellationToken = default)
    {
        if (source == null)
            throw new ArgumentNullException(nameof(source));
        if (!source.CanRead)
            throw new ArgumentException("Has to be readable", nameof(source));
        if (destination == null)
            throw new ArgumentNullException(nameof(destination));
        if (!destination.CanWrite)
            throw new ArgumentException("Has to be writable", nameof(destination));
        if (bufferSize < 0)
            throw new ArgumentOutOfRangeException(nameof(bufferSize));

        var buffer = new byte[bufferSize];
        long totalBytesRead = 0;
        int bytesRead;
        while ((bytesRead = await source.ReadAsync(buffer, 0, buffer.Length, cancellationToken).ConfigureAwait(false)) != 0)
        {
            await destination.WriteAsync(buffer, 0, bytesRead, cancellationToken).ConfigureAwait(false);
            totalBytesRead += bytesRead;
            progress?.Report(totalBytesRead);
        }
    }
}

internal sealed class ThemedToolStripRenderer : ToolStripProfessionalRenderer
{
    public ThemedToolStripRenderer() : base(new ThemedColorTable()) { }

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        using Pen borderPen = new Pen(ThemeEditor.ButtonsBorder);
        Rectangle border = new Rectangle(Point.Empty, e.ToolStrip.Size - new Size(1, 1));
        e.Graphics.DrawRectangle(borderPen, border);
    }

    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        e.TextColor = ThemeEditor.ButtonsForeground;
        base.OnRenderItemText(e);
    }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        Rectangle bounds = new Rectangle(Point.Empty, e.Item.Size);
        Color fill = e.Item.Selected ? ThemeEditor.ButtonsBackground.Lerp(ThemeEditor.ButtonsBorder, 0.3f) : ThemeEditor.FormsBackground.Lerp(ThemeEditor.ButtonsBackground, 0.5f);

        using GraphicsPath path = CreateRoundRect(bounds, 6);
        using SolidBrush brush = new SolidBrush(fill);
        using Pen borderPen = new Pen(ThemeEditor.ButtonsBorder);

        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.FillPath(brush, path);
        e.Graphics.DrawPath(borderPen, path);
    }

    private static GraphicsPath CreateRoundRect(Rectangle bounds, int radius)
    {
        int diameter = radius * 2;
        Rectangle arc = new Rectangle(bounds.Location, new Size(diameter, diameter));
        GraphicsPath path = new GraphicsPath();

        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();

        return path;
    }
}

internal sealed class ThemedColorTable : ProfessionalColorTable
{
    public ThemedColorTable() => UseSystemColors = false;

    public override Color MenuBorder => ThemeEditor.ButtonsBorder;
    public override Color MenuItemBorder => ThemeEditor.ButtonsBorder;
    public override Color MenuItemSelected => ThemeEditor.ButtonsBackground.Lerp(ThemeEditor.ButtonsBorder, 0.3f);
    public override Color MenuItemSelectedGradientBegin => MenuItemSelected;
    public override Color MenuItemSelectedGradientEnd => MenuItemSelected;
    public override Color MenuItemPressedGradientBegin => ThemeEditor.ButtonsBackground;
    public override Color MenuItemPressedGradientMiddle => ThemeEditor.ButtonsBackground;
    public override Color MenuItemPressedGradientEnd => ThemeEditor.ButtonsBackground;
    public override Color ToolStripDropDownBackground => ThemeEditor.FormsBackground.Lerp(ThemeEditor.ButtonsBackground, 0.5f);
    public override Color ImageMarginGradientBegin => ToolStripDropDownBackground;
    public override Color ImageMarginGradientMiddle => ToolStripDropDownBackground;
    public override Color ImageMarginGradientEnd => ToolStripDropDownBackground;
    public override Color SeparatorDark => ThemeEditor.ButtonsBorder;
    public override Color SeparatorLight => ThemeEditor.ButtonsBackground.Lerp(Color.White, 0.08f);
}
