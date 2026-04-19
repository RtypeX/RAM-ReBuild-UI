using RBX_Alt_Manager.Classes;
using System.Drawing;
using System.Windows.Forms;

namespace RBX_Alt_Manager.Forms
{
    public partial class MissingAssets : Form
    {
        public Account account;

        private MissingAssets()
        {
            InitializeComponent();
            this.Rescale();
        }

        public MissingAssets(Account account, params long[] Assets) : this()
        {
            this.account = account;

            Text = $"Missing Assets for {account.Username}";

            foreach (long ID in Assets)
                AssetPanel.Controls.Add(new MissingAssetControl(ID));

            ApplyTheme();
        }

        #region Themes

        public void ApplyTheme()
        {
            BackColor = ThemeEditor.FormsBackground;
            ForeColor = ThemeEditor.FormsForeground;

            Controls.ApplyTheme();
        }

        public void ApplyTheme(Control.ControlCollection _Controls)
        {
            _Controls.ApplyTheme();
        }

        #endregion
    }
}
